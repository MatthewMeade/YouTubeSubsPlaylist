// GENERAL

function makePromise(fn) {
    return (...args) =>
        new Promise((res, rej) => {
            fn(...args, (...resArgs) => res(resArgs));
        });
}

function filterFeed(feed, playlistContents) {
    const exitingIds = playlistContents.map(e=>e.videoId);
    return feed.filter((v) => 
        Date.now() - v.published < MAX_AGE &&
        !exitingIds.includes(v.id)
    )
}

// For Deugging
function sleep(time) {
    return new Promise((res) => {
        setTimeout(res, time);
    })
}

// AUTH

function isSignedIn() {
    return auth2.isSignedIn.get();
}

function isAutoRunSet() {
    return new URLSearchParams(window.location.search).get('autorun') !== null;
}

async function logout() {
    await auth2.signOut();
}

// BROWSER

async function openPlaylist(newTab = true, autoPlay, playlistId) {
    let url;
    if (autoPlay) {
        url = `https://www.youtube.com/watch?v=${
            (await getPlaylistContents(playlistId))[0].videoId
        }&list=${playlistId}&index=1`;
    } else {
        url = `https://youtube.com/playlist?list=${playlistId}`;
    }

    if (newTab) {
        const tabRef = window.open(url, '_blank', ['noopener']);

        if (!tabRef) {
            updateLogText("Done! <br /> Allow popups to open playlist automatically");
        }
    } else {
        window.location.href = url;
    }
}

// DOM UPDATE FUNCTIONS

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

function createBookmarkLink() {
    const url = window.location.href + '?autorun';
    document.querySelector('#bookmarkURL').setAttribute('href', url);
    document.querySelector('#bookmarkURL').innerHTML = url;
}