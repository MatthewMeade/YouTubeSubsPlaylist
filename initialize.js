init();

function init() {
    initializeAPI();

    document.querySelector('#startButton').addEventListener('click', buildPlaylist);
}

async function initializeAPI() {
    await Promise.all([
        makePromise(gapi.load)('signin2'),
        makePromise(gapi.load)('client:auth2').then(() =>
            gapi.client.load('https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest')
        )
    ]);

    const auth2 = gapi.auth2.init({
        client_id: '495280427630-v5oe9c0j566drge7e7mk9r5jvacp3bmq.apps.googleusercontent.com'
    });

    window.yt = gapi.client.youtube;
    window.auth2 = auth2;

    gapi.signin2.render('loginButton', {
        theme: 'dark',
        onsuccess: loggedIn,
        scope: 'https://www.googleapis.com/auth/youtube'
    });

    if (!isSignedIn()) {
        loggedOut();
    }

    document.body.classList.remove('initializing');
}
