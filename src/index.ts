import { google } from 'googleapis';
import { fetchYahooNewsRanking, YahooNewsItem } from './yahoo/fetchRanking';
import { fetchArticleBody } from './fetchArticleBody';
import { generateArticleSummary } from './aiArticleSummary';
import { generateCaption } from './aiCaption';
import { buildTweet } from './buildTweet';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1p0p_QNN79JiA_ir0kXfrlOtRYI8gm7xOuT7MZosOiIc';

export const fetchYahooNews = async (req: any, res: any): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth });

    // URL 重複チェック (F列: url)
    const existingUrlsResponse = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'news-sheet1!F:F',
    });
    const existingUrls = new Set(
      (existingUrlsResponse.data.values ?? [])
        .map((row) => row[0])
        .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
        .map((url) => url.trim()),
    );

    const items: YahooNewsItem[] = await fetchYahooNewsRanking();
    const newItems = items.filter((item) => !existingUrls.has(item.url.trim())).slice(0, 5);

    console.log(
      `Fetched ${items.length} items from Yahoo RSS; existing URLs: ${existingUrls.size}; new items: ${newItems.length}`,
    );

    if (!newItems.length) {
      res.status(200).send('No new items');
      return;
    }

    const values: any[] = [];
    let failedCount = 0;

    for (const item of newItems) {
      const url = item.url.trim();

      let body = '';
      try {
        body = await fetchArticleBody(url);
        console.log(`[fetchArticleBody] url=${url} length=${body.length}`);
      } catch (bodyErr) {
        console.error(`Failed to fetch body: ${url}`, bodyErr);
      }

      let summaryLong = item.title;
      let hashtagsList: string[] = ['#ニュース'];
      let captionText = item.title;
      let captionHashtags = '#ニュース';

      try {
        const summary = await generateArticleSummary({
          title: item.title,
          source: item.category,
          url,
          body,
        });
        if (!summary || (!summary.title && !summary.summaryLong && (!summary.hashtags || !summary.hashtags.length))) {
          console.warn(`[generateArticleSummary] Empty response for url=${url}`);
        } else {
          console.log(
            `[generateArticleSummary] url=${url} titleLen=${(summary.title || '').length} summaryLongLen=${(summary.summaryLong || '').length} hashtags=${summary.hashtags?.join(' ')}`,
          );
        }
        summaryLong = summary.summaryLong || summary.title || summaryLong;
        hashtagsList = summary.hashtags.length ? summary.hashtags.slice(0, 4) : hashtagsList;
      } catch (summaryErr) {
        console.error(`Failed to summarize item: ${url}`, summaryErr);
      }

      try {
        const caption = await generateCaption(item.title, item.category);
        if (!caption || (!caption.caption && !caption.hashtags)) {
          console.warn(`[generateCaption] Empty response for url=${url}`);
        } else {
          console.log(
            `[generateCaption] url=${url} captionLen=${(caption.caption || '').length} hashtags=${caption.hashtags || ''}`,
          );
        }
        captionText = caption.caption || captionText;
        captionHashtags = caption.hashtags || captionHashtags;
      } catch (captionErr) {
        console.error(`Failed to generate caption: ${url}`, captionErr);
      }

      try {
        const hashtagsString = hashtagsList.join(' ');
        const tweetText = buildTweet(captionText, url, captionHashtags || hashtagsString);

        // A:source B:category C:fetched_at D:title E:summary F:url G:Hashtags H:tweet draft I:tweet_id J:posted_at K:condition
        values.push([
          'yahoo_rss',
          item.category ?? '',
          item.fetchedAt,
          item.title,
          summaryLong,
          url,
          captionHashtags || hashtagsString,
          tweetText,
          '',
          '',
          '',
        ]);
      } catch (itemErr) {
        failedCount += 1;
        console.error(`Failed to process item: ${url}`, itemErr);
      }
    }

    if (!values.length) {
      console.error(`No rows appended. failedCount=${failedCount}, newItems=${newItems.length}`);
      res.status(200).send('No new items could be processed');
      return;
    }

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'news-sheet1!A:K',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    console.log(`Appended ${values.length} rows to sheet (failed: ${failedCount})`);
    res.status(200).send(`OK: appended ${values.length} rows`);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR');
  }
};

export const postNewsFromSheet = async (req: any, res: any): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth });

    const rowsResponse = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'news-sheet1!A:K',
    });

    const rows = rowsResponse.data.values ?? [];
    const targetIndex = rows.findIndex((row) => {
      const postedAt = row[9]; // J: posted_at
      return !postedAt || `${postedAt}`.trim() === '';
    });

    if (targetIndex === -1) {
      res.status(200).send('未投稿の記事なし');
      return;
    }

    const row = rows[targetIndex];
    const title = row[3] ?? ''; // D: title
    const summary = row[4] ?? ''; // E: summary
    const url = row[5] ?? ''; // F: url
    const hashtags = row[6] ?? ''; // G: hashtags

    const tweetDraft = buildTweet(summary || title, url, hashtags);
    // TODO: Call X API to post tweetDraft

    const rowNumber = targetIndex + 1; // Sheets is 1-based
    const now = new Date().toISOString();

    await sheetsApi.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: `news-sheet1!J${rowNumber}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[now]],
      },
    });

    console.log(`Posted one item: title="${title}", url=${url}, row=${rowNumber}`);
    res.status(200).send(`OK: posted one item (row ${rowNumber})`);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR');
  }
};
