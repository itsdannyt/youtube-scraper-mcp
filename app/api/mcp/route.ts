import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

async function getChannelStats(channelId: string) {
  const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics,snippet&id=${channelId}&key=${YOUTUBE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  if (!data.items?.[0]) throw new Error('Channel not found');
  const stats = data.items[0].statistics;
  const snippet = data.items[0].snippet;
  return {
    title: snippet.title,
    subscribers: parseInt(stats.subscriberCount),
    views: parseInt(stats.viewCount),
    videos: parseInt(stats.videoCount)
  };
}

async function getVideoComments(videoId: string) {
  const url = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&videoId=${videoId}&maxResults=100&key=${YOUTUBE_API_KEY}`;
  const response = await fetch(url);
  const data = await response.json();
  return (data.items || []).map((item: any) => ({
    author: item.snippet.topLevelComment.snippet.authorDisplayName,
    text: item.snippet.topLevelComment.snippet.textDisplay,
    likes: item.snippet.topLevelComment.snippet.likeCount,
    publishedAt: item.snippet.topLevelComment.snippet.publishedAt
  }));
}

async function getChannelOutliers(channelId: string) {
  const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&maxResults=50&order=date&type=video&key=${YOUTUBE_API_KEY}`;
  const searchResponse = await fetch(url);
  const searchData = await searchResponse.json();
  const videoIds = (searchData.items || []).map((item: any) => item.id.videoId).join(',');
  
  const statsUrl = `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
  const statsResponse = await fetch(statsUrl);
  const statsData = await statsResponse.json();
  
  const videos = (statsData.items || []).map((item: any) => ({
    id: item.id,
    title: item.snippet.title,
    views: parseInt(item.statistics.viewCount),
    publishedAt: item.snippet.publishedAt
  }));
  
  const avgViews = videos.reduce((acc: number, v: any) => acc + v.views, 0) / videos.length;
  return videos.filter((v: any) => v.views > avgViews * 2);
}

export async function POST(request: Request) {
  try {
    const { method, params } = await request.json();

    if (!YOUTUBE_API_KEY) {
      return NextResponse.json({ error: 'YOUTUBE_API_KEY not configured' }, { status: 500 });
    }

    let result;
    switch (method) {
      case 'get_channel_stats':
        result = await getChannelStats(params.channelId);
        break;
      case 'get_video_comments':
        result = await getVideoComments(params.videoId);
        break;
      case 'get_channel_outliers':
        result = await getChannelOutliers(params.channelId);
        break;
      default:
        return NextResponse.json({ error: `Method ${method} not found` }, { status: 404 });
    }

    return NextResponse.json({ result });

  } catch (error: any) {
    console.error('[MCP/youtube-scraper] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
