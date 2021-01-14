// Settings TODO: Make these configurable
const PLAYLIST_TITLE = 'Subscriptions';
const MAX_AGE = 604800000; // 1 Week

let running = false;
async function buildPlaylist() {
    
    // Prevent running multiple times
    if (running) return false;
    running = true;

    updateButtonText('Running...');

    let playlistId;
    try {
        const feed = await getFeed();

        // Find existing playlist, create it if one doesn't exist
        playlistId = await findExistingPlaylist();
        let playlistContents = [];
        if (playlistId) {
            playlistContents = await getPlaylistContents(playlistId);
        } else {
            playlistId = await createPlayList();
        }

        // Filter down to recent videos not already in the playlist 
        const curDate = Date.now();
        const filteredFeed = feed.filter((v) => curDate - v.published < MAX_AGE && !playlistContents.includes(v.id));


        let count = 0; 
        // Loop through feed in reverse so playlist items appear in the correct order
        for (let i = filteredFeed.length - 1; i >= 0; i--) {
            updateLogText(`Adding video ${++count} / ${filteredFeed.length}`);
            await yt.playlistItems.insert({
                part: ['snippet'],
                resource: {
                    snippet: {
                        playlistId,
                        position: 0, // Add to beginning of playlist
                        resourceId: {
                            kind: 'youtube#video',
                            videoId: filteredFeed[i].id
                        }
                    }
                }
            });
        }

        updateLogText(`Done!`);
    } catch (e) {
        console.error(e);
        updateLogText('Something went wrong, try again. <br />\
         Try deleting the existing playlist if issue persists');
    } finally {
        running = false;
        updateButtonText('Update Playlist');
        return playlistId;
    }
}

async function getPlaylistContents(playlistId) {
    updateLogText('Getting Playlist Contents');

    const items = [];
    let pageToken;
    do {
        const response = await yt.playlistItems.list({
            part: ['contentDetails,snippet'],
            order: 'alphabetical',
            pageToken,
            maxResults: 50,
            playlistId
        });

        const body = response.result;
        pageToken = body.nextPageToken;
        items.push(...body.items);
    } while (pageToken);

    return items.map((i) => i.contentDetails.videoId);
}

async function findExistingPlaylist(updateLog) {
    // TODO: Support channels with >50 playlists

    updateLog && updateLogText('Finding Existing Playlist');

    const {
        result: { items }
    } = await yt.playlists.list({
        part: ['id,snippet'],
        maxResults: 50,
        mine: true
    });

    const matching = items.filter((p) => p.snippet.title === PLAYLIST_TITLE);
    return matching[0]?.id;
}

async function createPlayList() {
    updateLogText('Creating New Playlist');

    const { result } = await yt.playlists.insert({
        part: ['id,snippet'],
        resource: {
            snippet: {
                title: PLAYLIST_TITLE,
                description: 'Playlist of Current Subscriptions Feed',
                privacyStatus: 'public'
            }
        }
    });
    return result.id;
}

async function getSubs() {
    let pageToken;
    const subs = [];

    updateLogText('Fetching Subscriptions');

    do {
        const response = await yt.subscriptions.list({
            part: ['snippet'],
            mine: true,
            maxResults: 50,
            pageToken,
            order: 'alphabetical'
        });

        const body = response.result;
        pageToken = body.nextPageToken;
        subs.push(...body.items);
    } while (pageToken);

    return subs.map((s) => s.snippet.resourceId.channelId);
}

async function getFeed() {
    const subs = await getSubs();
    const totalSubs = subs.length;
    let doneSubs = 0;

    const promises = subs.map(async (id) => {
        // CORS Proxy
        const url = `https://youtube.matthewmeade.workers.dev/channel_id/${id}`;
        const text = await (await fetch(url)).text();

        updateLogText(`Fetching Channel Videos: ${++doneSubs} / ${totalSubs}`);

        return new DOMParser().parseFromString(text, 'application/xml');
    });

    const documents = await Promise.all(promises);

    const videos = [];
    documents.forEach((doc) => {
        const entries = [...doc.querySelectorAll('entry')];

        entries.forEach((entry) => {
            const id = entry.getElementsByTagName('yt:videoId')[0].textContent;
            const title = entry.getElementsByTagName('title')[0].textContent;
            const published = Date.parse(entry.getElementsByTagName('published')[0].textContent);
            const author = {
                name: entry.querySelector('author name').textContent
            };

            videos.push({
                id,
                title,
                published,
                author
            });
        });
    });

    return videos.sort((a, b) => b.published - a.published);
}
