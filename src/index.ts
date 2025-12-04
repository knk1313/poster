import { google } from 'googleapis';
import { fetchYahooNewsRanking, YahooNewsItem } from './yahoo/fetchRanking';

const SPREADSHEET_ID = process.env.SPREADSHEET_ID || '1p0p_QNN79JiA_ir0kXfrlOtRYI8gm7xOuT7MZosOiIc';

export const fetchYahooNews = async (req: any, res: any): Promise<void> => {
  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    await auth.getClient();
    const sheetsApi = google.sheets({ version: 'v4', auth });

    const existingUrlsResponse = await sheetsApi.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: 'news-sheet1!C:C',
    });
    const existingUrls = new Set(
      (existingUrlsResponse.data.values ?? [])
        .map((row) => row[0])
        .filter((url): url is string => typeof url === 'string' && url.trim() !== '')
        .map((url) => url.trim()),
    );

    const items: YahooNewsItem[] = await fetchYahooNewsRanking();
    const newItems = items.filter((item) => !existingUrls.has(item.url.trim()));

    console.log(
      `Fetched ${items.length} items from Yahoo RSS; existing URLs: ${existingUrls.size}; new items: ${newItems.length}`,
    );

    if (!newItems.length) {
      res.status(200).send('No new items');
      return;
    }

    const values = newItems.map((item) => {
      const url = item.url.trim();
      return [
        '', // A: posted_at
        'yahoo_rss', // B: source
        url, // C: url
        item.title, // D: title
        '', // E: tweet_id
        '', // F: summary
        '', // G: condition
        item.fetchedAt, // H: fetched_at
        item.category ?? '', // I: category
      ];
    });

    await sheetsApi.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: 'news-sheet1!A:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values,
      },
    });

    console.log('Appended to sheet');
    res.status(200).send(`OK: appended ${newItems.length} rows`);
  } catch (err) {
    console.error(err);
    res.status(500).send('ERROR');
  }
};
