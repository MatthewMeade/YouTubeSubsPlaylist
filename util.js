function makePromise(fn) {
    return (...args) => new Promise((res, rej) => {
        fn(...args, (...resArgs) => (res(resArgs)));
    })
} 