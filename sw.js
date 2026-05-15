const CACHE_NAME = "rwotd-v7";
const ASSETS = [
    ".",
    "index.html",
    "style.css",
    "app.js",
    "words.json",
    "manifest.json",
    "icons/icon.svg",
    "icons/icon-192.png",
    "icons/icon-512.png",
    "icons/apple-touch-icon.png",
];

// Install: cache all assets
self.addEventListener("install", function (event) {
    event.waitUntil(
        caches.open(CACHE_NAME).then(function (cache) {
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", function (event) {
    event.waitUntil(
        caches.keys().then(function (keys) {
            return Promise.all(
                keys
                    .filter(function (key) {
                        return key !== CACHE_NAME;
                    })
                    .map(function (key) {
                        return caches.delete(key);
                    })
            );
        })
    );
    self.clients.claim();
});

// ---- Push notification messages ----
var notifMessages = [
    "My love, time for RWOTD! \ud83c\udf38",
    "New day, new RWOTD! \ud83d\udc95",
    "A new Romanian word awaits you! \ud83c\udf37",
    "Don't forget your word today, draga mea! \ud83c\udf3a",
    "RWOTD time! Come learn something new \ud83d\udc90",
    "Hey love, your word is waiting for you! \ud83d\udc95",
    "Nothing special... just your Romanian word waiting to humble you \ud83c\udf38",
    "You all right? Because today's word is ready for battle \ud83d\udc95",
    "RWOTD time, my love - let's see what happens to that shy little 'i' today \ud83c\udf37",
    "Another day, another Romanian word you can almost pronounce \ud83c\udf3a",
    "Come on love, your daily beef with Romanian is ready \ud83d\udc90",
    "Hey gorgeous, your word is here - confidence optional \ud83d\udc95",
    "Draga mea, today's word is waiting... and yes, it probably ends in 'i' \ud83c\udf38",
    "RWOTD is here! Time to bully your English tongue a little \ud83d\ude02",
    "My love, ready to absolutely charm me and mispronounce one syllable? \ud83d\udc95",
    "Another beautiful day to say, 'you reckon I can pronounce this?' \ud83c\udf3a",
    "Your word is ready, love - and so is my laughter \ud83d\udc90",
    "RWOTD time! Let's see if the final 'i' shows up today \ud83d\ude0f",
    "My girl, so many days... but can you say ur\u015fi? \ud83d\udc3b",
    "A fresh Romanian word for the love of my life to completely reinvent \ud83d\udc95",
    "Nothing special... just another chance to defeat Romanian. Or be defeated by it \ud83c\udf38",
    "Hey love, your word of the day is here - pronunciation under investigation \ud83c\udf37",
    "Today's mission: learn the word, survive the accents, kiss me later \ud83c\udf3a",
    "You all right, love? Romanian isn't \ud83d\udc95",
    "RWOTD time - cute face, suspicious pronunciation \ud83d\ude02",
    "My favourite student, your next victim has arrived \ud83c\udf38",
    "Another day, another word standing between you and fluency \ud83d\udc90",
    "Hey love, this one might finally make peace with your tongue \ud83c\udf37",
    "Come collect your daily Romanian chaos, draga mea \ud83c\udf3a",
    "RWOTD is waiting patiently, unlike me when you skip the last 'i' \ud83d\ude02",
    "Today's word has that special little sparkle... and probably some suffering \ud83c\udf38",
    "Hey beautiful, ready to sound adorable and slightly incorrect? \ud83c\udf37",
    "Your Romanian word is here, and honestly, it's feeling brave \ud83c\udf3a",
    "Another lovely day for you to impress me and confuse native speakers \ud83d\udc90"
];

// Push event — server wakes us up, we pick a random message
self.addEventListener("push", function (event) {
    var msg = notifMessages[Math.floor(Math.random() * notifMessages.length)];
    event.waitUntil(
        self.registration.showNotification("RWOTD", {
            body: msg,
            icon: "icons/icon-192.png",
            badge: "icons/icon-192.png",
            tag: "rwotd-reminder",
            renotify: true,
        })
    );
});

// Tap on notification — focus app or open it
self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    event.waitUntil(
        clients
            .matchAll({ type: "window", includeUncontrolled: true })
            .then(function (clientList) {
                for (var i = 0; i < clientList.length; i++) {
                    if (
                        clientList[i].url.indexOf(self.location.origin) !== -1 &&
                        "focus" in clientList[i]
                    ) {
                        return clientList[i].focus();
                    }
                }
                if (clients.openWindow) {
                    return clients.openWindow("./");
                }
            })
    );
});

// Fetch: cache-first, fallback to network
self.addEventListener("fetch", function (event) {
    event.respondWith(
        caches.match(event.request).then(function (cached) {
            if (cached) {
                return cached;
            }
            return fetch(event.request).then(function (response) {
                // Don't cache non-GET or external requests
                if (
                    event.request.method !== "GET" ||
                    !event.request.url.startsWith(self.location.origin)
                ) {
                    return response;
                }
                var responseClone = response.clone();
                caches.open(CACHE_NAME).then(function (cache) {
                    cache.put(event.request, responseClone);
                });
                return response;
            });
        })
    );
});
