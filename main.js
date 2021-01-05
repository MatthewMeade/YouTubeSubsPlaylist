const PLAYLIST_TITLE = 'Subscriptions'; // TODO: Make this configurable
let running = false;

function updatePlaylistLink(playlistId) {
    const aRef = document.querySelector('#playlistUrl');
    if (playlistId) {
        aRef.setAttribute('href', `https://youtube.com/playlist?list=${playlistId}`);
    } else {
        aRef.removeAttribute('href');
    }
}
function updateLogText(txt) {
    document.querySelector('#statusLog').innerHTML = txt;
}

function updateButtonText(txt) {
    document.querySelector('#startButton').innerHTML = txt;
}

async function signinChanged() {
    const isSignedIn = auth2.isSignedIn.get();
    if (isSignedIn) {
        await loggedIn();
    } else {
        loggedOut();
    }

    document.body.classList.remove('initializing');
}
async function loggedIn() {
    const existingId = await findExistingPlaylist(false);

    if (existingId) {
        updateButtonText('Update Playlist');
        updatePlaylistLink(existingId);
    }

    document.body.classList.add('signedIn');
    document.body.classList.remove('signedOut');
}

function loggedOut() {
    updateButtonText('Create Playlist');
    updatePlaylistLink();

    document.body.classList.remove('signedIn');
    document.body.classList.add('signedOut');
}

const MAX_AGE = 604800000; // 1 Week

async function buildPlaylist() {
    if (running) {
        return false;
    }
    running = true;
    updateButtonText('Running...');

    try {
        const feed = await getFeed();

        let playlistId = await findExistingPlaylist();
        let playlistContents = [];
        if (playlistId) {
            playlistContents = await getPlaylistContents(playlistId);
        } else {
            playlistId = await createPlayList();
        }

        const curDate = Date.now();
        const filteredFeed = feed.filter(
            (v) => curDate - v.published < MAX_AGE && !playlistContents.includes(v.id)
        );

        // for (let i = 0; i < filteredFeed.length; i++) {
        let count = 0;
        for (let i = filteredFeed.length - 1; i > 0; i--) {
            updateLogText(`Adding video ${++count} / ${filteredFeed.length}`);
            await yt.playlistItems.insert({
                part: ['snippet'],
                resource: {
                    snippet: {
                        playlistId,
                        position: 0,
                        // position: playlistContents.length + filteredFeed.length - i,
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
        updateLogText(
            'Something went wrong, try again. <br /> Try deleting the existing playlist if issue persists'
        );
    } finally {
        running = false;
        updateButtonText('Update Playlist');
    }
}

async function getPlaylistContents(playlistId) {
    updateLogText('Getting Playlist Contents');

    const items = [];
    let pageToken;
    do {
        const response = await yt.playlistItems.list({
            part: ['contentDetails,snippet'],
            // fields: 'items/contentDetails/videoId',
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

    // TODO: Return cached playlist to prevent read? May have been deleted?

    updateLog && updateLogText('Finding Existing Playlist');

    const {
        result: { items }
    } = await yt.playlists.list({
        part: ['id,snippet'],
        maxResults: 50,
        mine: true
    });

    const matching = items.filter((p) => p.snippet.title === PLAYLIST_TITLE);
    const id = matching[0]?.id;

    localStorage.setItem('existingPlaylistId', id);

    return id;
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
