init();

function init() {
    initializeAPI();

    document.querySelector('#startButton').addEventListener('click', buildPlaylist);
}

async function initializeAPI() {

    // Load and initialize apis
    await Promise.all([
        makePromise(gapi.load)('signin2'),
        makePromise(gapi.load)('client:auth2').then(() =>
            gapi.client.load('https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest')
        )
    ]);

    const auth2 = gapi.auth2.init({
        client_id: '495280427630-v5oe9c0j566drge7e7mk9r5jvacp3bmq.apps.googleusercontent.com'
    });

    // Access some api variables in global scope
    window.yt = gapi.client.youtube;
    window.auth2 = auth2;

    gapi.signin2.render('loginButton', {
        theme: 'dark',
        onsuccess: loggedIn,
        scope: 'https://www.googleapis.com/auth/youtube'
    });

    // Wait a second to prevent flicker caused by delay logging back in
    setTimeout(() => {
        if (!isSignedIn()) {
            loggedOut();
        }
        document.body.classList.remove('initializing');
    }, 1000);
}

async function loggedIn() {
    const existingId = await findExistingPlaylist(false);

    if (existingId) {
        updateButtonText('Update Playlist');
        updatePlaylistLink(existingId);
        createBookmarkLink();

        if (isAutoRunSet()) {
            buildPlaylist();
            openPlaylist(false, true);
        }
    }

    document.querySelector("#header").append(...document.querySelector("#btnContainer").childNodes)

    document.body.classList.add('signedIn');
    document.body.classList.remove('signedOut');
}

function loggedOut() {
    updateButtonText('Create Playlist');
    updatePlaylistLink();

    document.querySelector("#btnContainer").append(...document.querySelector("#header").childNodes)

    document.body.classList.remove('signedIn');
    document.body.classList.add('signedOut');
}