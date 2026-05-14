(function () {
    "use strict";

    // ============ STATE ============
    let words = [];
    let timerInterval = null;

    // ============ DOM ELEMENTS ============
    const revealBtn = document.getElementById("reveal-btn");
    const cardEmpty = document.getElementById("card-empty");
    const cardContent = document.getElementById("card-content");
    const wordRomanian = document.getElementById("word-romanian");
    const wordPronunciation = document.getElementById("word-pronunciation");
    const wordDefinition = document.getElementById("word-definition");
    const wordPos = document.getElementById("word-pos");
    const timerSection = document.getElementById("timer-section");
    const timerDisplay = document.getElementById("timer");
    const exhaustedSection = document.getElementById("exhausted-section");
    const resetBtn = document.getElementById("reset-btn");
    const historyList = document.getElementById("history-list");
    const historyEmpty = document.getElementById("history-empty");
    const tabs = document.querySelectorAll(".tab");
    const views = document.querySelectorAll(".view");

    // ============ LOCAL STORAGE HELPERS ============
    function getStorage(key, fallback) {
        try {
            const val = localStorage.getItem(key);
            return val !== null ? JSON.parse(val) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            // storage full or blocked
        }
    }

    // ============ DATE HELPERS ============
    function getTodayStr() {
        const now = new Date();
        return (
            now.getFullYear() +
            "-" +
            String(now.getMonth() + 1).padStart(2, "0") +
            "-" +
            String(now.getDate()).padStart(2, "0")
        );
    }

    function getDayDiff(dateStrA, dateStrB) {
        // Calendar day difference (dateStrB - dateStrA) in days
        var a = new Date(dateStrA + "T00:00:00");
        var b = new Date(dateStrB + "T00:00:00");
        return Math.round((b - a) / 86400000);
    }

    function getMsUntilMidnight() {
        const now = new Date();
        const midnight = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate() + 1,
            0,
            0,
            0,
            0
        );
        return midnight - now;
    }

    function formatTime(ms) {
        if (ms <= 0) return "00:00:00";
        const totalSeconds = Math.floor(ms / 1000);
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        return (
            String(h).padStart(2, "0") +
            ":" +
            String(m).padStart(2, "0") +
            ":" +
            String(s).padStart(2, "0")
        );
    }

    // ============ FISHER-YATES SHUFFLE ============
    function shuffleArray(arr) {
        const shuffled = arr.slice();
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            const temp = shuffled[i];
            shuffled[i] = shuffled[j];
            shuffled[j] = temp;
        }
        return shuffled;
    }

    // ============ WORD ORDER ============
    function getWordOrder() {
        let order = getStorage("rwotd_wordOrder", null);
        if (!order || order.length !== words.length) {
            order = shuffleArray(
                Array.from({ length: words.length }, function (_, i) {
                    return i;
                })
            );
            setStorage("rwotd_wordOrder", order);
        }
        return order;
    }

    function getCurrentIndex() {
        return getStorage("rwotd_currentIndex", 0);
    }

    function setCurrentIndex(idx) {
        setStorage("rwotd_currentIndex", idx);
    }

    // ============ HISTORY ============
    function getHistory() {
        return getStorage("rwotd_history", []);
    }

    function addToHistory(wordObj, date) {
        const history = getHistory();
        history.unshift({ word: wordObj, date: date });
        setStorage("rwotd_history", history);
    }

    // ============ REVEAL LOGIC ============
    function hasRevealedToday() {
        return getStorage("rwotd_lastRevealDate", "") === getTodayStr();
    }

    function getTodaysWord() {
        return getStorage("rwotd_todaysWord", null);
    }

    function revealWord() {
        const order = getWordOrder();
        const idx = getCurrentIndex();

        if (idx >= words.length) {
            showExhausted();
            return;
        }

        const wordObj = words[order[idx]];
        setCurrentIndex(idx + 1);
        setStorage("rwotd_lastRevealDate", getTodayStr());
        setStorage("rwotd_todaysWord", wordObj);
        addToHistory(wordObj, getTodayStr());
        updateStreak();
        requestNotifPermission();
        displayWord(wordObj);
        disableButton();
        startTimer();
    }

    function displayWord(wordObj) {
        cardEmpty.classList.add("hidden");
        cardContent.classList.remove("hidden");
        wordRomanian.textContent = wordObj.word;
        wordPronunciation.textContent = wordObj.pronunciation;
        wordDefinition.textContent = wordObj.definition;
        wordPos.textContent = wordObj.partOfSpeech;
    }

    function disableButton() {
        revealBtn.disabled = true;
        revealBtn.classList.add("hidden");
    }

    function enableButton() {
        revealBtn.disabled = false;
        revealBtn.classList.remove("hidden");
    }

    function showExhausted() {
        revealBtn.classList.add("hidden");
        timerSection.classList.add("hidden");
        cardEmpty.classList.add("hidden");
        cardContent.classList.add("hidden");
        exhaustedSection.classList.remove("hidden");
        var lastReveal = getStorage("rwotd_lastRevealDate", "");
        if (lastReveal && lastReveal !== getTodayStr()) {
            showCompletionOverlay();
        }
    }

    function showCompletionOverlay() {
        var overlay = document.getElementById("completion-overlay");
        if (overlay) overlay.classList.remove("hidden");
        var el = document.getElementById("streak-count");
        if (el) el.textContent = "\u221e";
        var badge = document.getElementById("streak-badge");
        if (badge) badge.style.zIndex = "2100";
    }

    // ============ TIMER ============
    function startTimer() {
        timerSection.classList.remove("hidden");
        updateTimer();
        if (timerInterval) clearInterval(timerInterval);
        timerInterval = setInterval(function () {
            updateTimer();
        }, 1000);
    }

    function updateTimer() {
        const ms = getMsUntilMidnight();
        timerDisplay.textContent = formatTime(ms);
        if (ms <= 0) {
            clearInterval(timerInterval);
            timerInterval = null;
            onNewDay();
        }
    }

    function onNewDay() {
        timerSection.classList.add("hidden");
        cardEmpty.classList.remove("hidden");
        cardContent.classList.add("hidden");

        const order = getWordOrder();
        const idx = getCurrentIndex();
        if (idx >= order.length) {
            var lastReveal = getStorage("rwotd_lastRevealDate", "");
            if (lastReveal && lastReveal !== getTodayStr()) {
                enableButton();
            } else {
                showExhausted();
            }
        } else {
            enableButton();
        }
    }

    // ============ HISTORY RENDER ============
    function renderHistory() {
        const history = getHistory();
        if (history.length === 0) {
            historyEmpty.classList.remove("hidden");
            historyList.innerHTML = "";
            return;
        }
        historyEmpty.classList.add("hidden");
        historyList.innerHTML = history
            .map(function (entry) {
                const d = new Date(entry.date + "T00:00:00");
                const dateStr = d.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                });
                return (
                    '<div class="history-item" tabindex="0">' +
                    '<div class="history-date">' +
                    dateStr +
                    "</div>" +
                    '<div class="history-word">' +
                    escapeHtml(entry.word.word) +
                    '<span class="history-pos">' +
                    escapeHtml(entry.word.partOfSpeech) +
                    "</span></div>" +
                    '<div class="history-def">' +
                    escapeHtml(entry.word.definition) +
                    "</div>" +
                    '<div class="history-pronunciation">' +
                    escapeHtml(entry.word.pronunciation) +
                    "</div>" +
                    "</div>"
                );
            })
            .join("");

        // Toggle expand on click
        historyList.querySelectorAll(".history-item").forEach(function (item) {
            item.addEventListener("click", function () {
                item.classList.toggle("history-item-expanded");
            });
        });
    }

    function escapeHtml(str) {
        var div = document.createElement("div");
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ============ TABS ============
    tabs.forEach(function (tab) {
        tab.addEventListener("click", function () {
            var target = tab.getAttribute("data-view");
            tabs.forEach(function (t) {
                t.classList.remove("active");
            });
            tab.classList.add("active");
            views.forEach(function (v) {
                v.classList.remove("active");
            });
            document.getElementById("view-" + target).classList.add("active");
            if (target === "history") {
                renderHistory();
            }
        });
    });

    // ============ STREAK ============
    function updateStreak() {
        var streakDate = getStorage("rwotd_streakDate", "");
        var streak = getStorage("rwotd_streak", 0);
        var today = getTodayStr();

        if (!streakDate) {
            streak = 1;
        } else {
            var diff = getDayDiff(streakDate, today);
            if (diff === 0) {
                // Already counted today
                return;
            } else if (diff === 1) {
                streak += 1;
            } else {
                // Missed days
                streak = 1;
            }
        }
        setStorage("rwotd_streak", streak);
        setStorage("rwotd_streakDate", today);
        displayStreak();
        checkMilestone(streak);
    }

    function checkStreakBroken() {
        var streakDate = getStorage("rwotd_streakDate", "");
        if (!streakDate) return;
        var diff = getDayDiff(streakDate, getTodayStr());
        if (diff > 1) {
            setStorage("rwotd_streak", 0);
            setStorage("rwotd_streakDate", "");
        }
    }

    function migrateStreak() {
        // If streakDate already set, no migration needed
        if (getStorage("rwotd_streakDate", "")) return;
        // Bootstrap streak from history for users who had words before this feature
        var history = getHistory();
        if (history.length === 0) return;
        var today = getTodayStr();
        // Sort dates descending (history is already newest-first)
        var dates = [];
        for (var i = 0; i < history.length; i++) {
            var d = history[i].date;
            if (dates.indexOf(d) === -1) dates.push(d);
        }
        // Count consecutive days backwards from most recent
        var streak = 1;
        for (var j = 0; j < dates.length - 1; j++) {
            if (getDayDiff(dates[j + 1], dates[j]) === 1) {
                streak++;
            } else {
                break;
            }
        }
        // Only count if streak is still active (most recent date is today or yesterday)
        var mostRecent = dates[0];
        var diffToToday = getDayDiff(mostRecent, today);
        if (diffToToday <= 1) {
            setStorage("rwotd_streak", streak);
            setStorage("rwotd_streakDate", mostRecent);
        } else {
            setStorage("rwotd_streak", 0);
            setStorage("rwotd_streakDate", "");
        }
    }

    function displayStreak() {
        var streak = getStorage("rwotd_streak", 0);
        var el = document.getElementById("streak-count");
        if (el) el.textContent = streak;
    }

    // ============ MILESTONES ============
    var milestoneTens = {
        10: "Nothing special… just me falling for you a bit more every day.",
        20: "You all right? Because I'm definitely not… I'm completely into you.",
        30: "So many days… but can you say urși yet?",
        40: "You bring warmth, chaos, and just the right amount of 'you reckon?' into my life.",
        50: "Being with you feels like home… even when I say 'nothing special' and it's actually everything.",
        60: "I admire you more every day—even your questionable Romanian 'i' skills.",
        70: "You've become one of the most precious parts of my life… no commitment issues for this girl, clearly.",
        80: "No matter what happens, my heart just goes 'yeah… her. definitely her.'",
        90: "You make my life more beautiful… and a lot funnier than I expected.",
    };

    var milestoneHundreds = {
        100: "100 days?! You reckon that's impressive? Because I do. A lot.",
        200: "Your commitment to Romanian is legendary… pronunciation still under review though.",
        300: "300 days of 'nothing special' that somehow mean absolutely everything to me.",
        400: "Over a year?! You all right?? Because that's insane.",
        500: "Half a thousand! At this point, even your 'shy i' is kind of perfect.",
        600: "Your perseverance knows no bounds… unlike your ability to pronounce that last 'i'.",
        700: "Nearly two years—no commitment issues, confirmed.",
        800: "800 days of you being amazing… and me being completely gone for you.",
        900: "So close to 1000… you reckon we just keep going forever?",
        1000: "1000 days. Nothing special… just you being the best thing in my life. I love you so much.",
    };

    function checkMilestone(streak) {
        // Special streak numbers
        if (streak === 67) {
            showMilestone("\ud83d\ude08\ud83d\udd22", "67676767676767676767");
            return;
        }
        if (streak === 69) {
            showMilestone("\ud83d\ude0f\ud83d\udd25", "69... Noice");
            return;
        }

        if (streak <= 0 || streak % 10 !== 0) return;

        var msg = null;
        var emoji = null;

        // Check hundreds first (100, 200, ... 1000)
        if (streak % 100 === 0 && streak <= 1000) {
            msg = milestoneHundreds[streak];
            emoji = "\ud83c\udf1f\ud83d\udc96\ud83c\udf1f";
            if (msg) {
                showMilestone(emoji, msg);
            }
        } else if (streak % 10 === 0) {
            // For 10-90, and cycling for 110-190, 210-290, etc.
            var key = streak % 100;
            msg = milestoneTens[key];
            emoji = "\ud83d\udd25\ud83c\udf38";
            if (msg) {
                showMilestone(emoji, "My love for you is now " + streak + " times stronger!\n" + msg);
            }
        }
    }

    // ============ DATE POPUPS ============
    function checkDatePopup() {
        var now = new Date();
        var day = now.getDate();
        var month = now.getMonth() + 1; // 1-indexed
        var shownKey = "rwotd_datePopup_" + now.getFullYear() + "-" + month + "-" + day;

        // Don't show the same date popup twice in one day
        if (getStorage(shownKey, false)) return;

        var msg = null;
        var emoji = null;

        if (month === 5 && day === 12) {
            // Birthday - May 12
            msg = "Happy birthday, I love you so much!";
            emoji = "\ud83c\udf82\ud83c\udf89\ud83d\udc96";
        } else if (day === 3) {
            // Anniversary - every 3rd of the month
            msg = "Happy anniversary, my love!";
            emoji = "\ud83d\udc95\ud83c\udf39\ud83d\udc8d";
        }

        if (msg) {
            setStorage(shownKey, true);
            showMilestone(emoji, msg);
        }
    }

    // ============ MILESTONE QUEUE ============
    var milestoneQueue = [];
    var milestoneShowing = false;

    function showMilestone(emoji, text) {
        milestoneQueue.push({ emoji: emoji, text: text });
        if (!milestoneShowing) {
            showNextMilestone();
        }
    }

    function showNextMilestone() {
        if (milestoneQueue.length === 0) {
            milestoneShowing = false;
            return;
        }
        milestoneShowing = true;
        var item = milestoneQueue.shift();

        var overlay = document.getElementById("milestone-overlay");
        var emojiEl = document.getElementById("milestone-emoji");
        var textEl = document.getElementById("milestone-text");
        var closeBtn = document.getElementById("milestone-close");
        if (!overlay) return;

        emojiEl.textContent = item.emoji;
        textEl.textContent = item.text;
        overlay.classList.remove("hidden");

        function close() {
            overlay.classList.add("hidden");
            closeBtn.removeEventListener("click", close);
            overlay.removeEventListener("click", handleOverlayClick);
            showNextMilestone();
        }
        function handleOverlayClick(e) {
            if (e.target === overlay) close();
        }
        closeBtn.addEventListener("click", close);
        overlay.addEventListener("click", handleOverlayClick);
    }

    // ============ COMPLETION RESET ============
    var completionResetBtn = document.getElementById("completion-reset-btn");
    if (completionResetBtn) {
        completionResetBtn.addEventListener("click", function () {
            if (confirm("This will reset all progress. You'll start fresh with a new random order. Continue?")) {
                localStorage.removeItem("rwotd_wordOrder");
                localStorage.removeItem("rwotd_currentIndex");
                localStorage.removeItem("rwotd_history");
                localStorage.removeItem("rwotd_lastRevealDate");
                localStorage.removeItem("rwotd_todaysWord");
                location.reload();
            }
        });
    }

    // ============ RESET ============
    resetBtn.addEventListener("click", function () {
        if (
            confirm(
                "This will reset all progress. You'll start fresh with a new random order. Continue?"
            )
        ) {
            localStorage.removeItem("rwotd_wordOrder");
            localStorage.removeItem("rwotd_currentIndex");
            localStorage.removeItem("rwotd_history");
            localStorage.removeItem("rwotd_lastRevealDate");
            localStorage.removeItem("rwotd_todaysWord");
            location.reload();
        }
    });

    // ============ REVEAL BUTTON ============
    revealBtn.addEventListener("click", function () {
        revealWord();
    });

    // ============ INIT ============
    async function init() {
        try {
            const response = await fetch("words.json");
            words = await response.json();
        } catch (e) {
            cardEmpty.innerHTML =
                '<p style="color:#e06060">Failed to load word database. Please refresh.</p>';
            return;
        }

        const order = getWordOrder();
        const idx = getCurrentIndex();

        if (idx >= words.length) {
            var lastReveal = getStorage("rwotd_lastRevealDate", "");
            if (lastReveal && lastReveal !== getTodayStr()) {
                enableButton();
                cardEmpty.classList.remove("hidden");
                cardContent.classList.add("hidden");
                checkStreakBroken();
                migrateStreak();
                displayStreak();
            } else {
                showExhausted();
            }
            return;
        }

        if (hasRevealedToday()) {
            var todaysWord = getTodaysWord();
            if (todaysWord) {
                displayWord(todaysWord);
            }
            disableButton();
            startTimer();
        } else {
            enableButton();
            cardEmpty.classList.remove("hidden");
            cardContent.classList.add("hidden");
        }

        checkStreakBroken();
        migrateStreak();
        displayStreak();
        checkDatePopup();
        setupNotifications();
    }

    // ============ NOTIFICATIONS ============
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
        "My girl, so many days... but can you say urși? \ud83d\udc3b",
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

    function setupNotifications() {
        if (!("Notification" in window)) return;
        if (Notification.permission === "granted") {
            scheduleNotification();
        }
    }

    function requestNotifPermission() {
        if (!("Notification" in window)) return;
        if (Notification.permission === "default") {
            Notification.requestPermission().then(function (perm) {
                if (perm === "granted") {
                    scheduleNotification();
                }
            });
        }
    }

    function scheduleNotification() {
        var now = new Date();
        var times = [10, 22]; // 10 AM and 10 PM

        for (var i = 0; i < times.length; i++) {
            scheduleAt(times[i], now);
        }
    }

    function scheduleAt(hour, now) {
        var target = new Date(
            now.getFullYear(),
            now.getMonth(),
            now.getDate(),
            hour, 0, 0, 0
        );
        if (now >= target) {
            target.setDate(target.getDate() + 1);
        }
        var ms = target - now;
        setTimeout(function () {
            showReminder();
            // Schedule next occurrence
            setTimeout(function () {
                scheduleAt(hour, new Date());
            }, 1000);
        }, ms);
    }

    function showReminder() {
        if (Notification.permission !== "granted") return;
        if (hasRevealedToday()) return; // Already did today's word
        var msg = notifMessages[Math.floor(Math.random() * notifMessages.length)];
        new Notification("RWOTD", {
            body: msg,
            icon: "icons/icon-192.png",
        });
    }

    // ============ SERVICE WORKER ============
    if ("serviceWorker" in navigator) {
        window.addEventListener("load", function () {
            navigator.serviceWorker
                .register("sw.js")
                .then(function (reg) {
                    console.log("SW registered:", reg.scope);
                })
                .catch(function (err) {
                    console.log("SW registration failed:", err);
                });
        });
    }

    // Start the app
    init();

    // === Love Stamp Easter Egg ===
    (function () {
        var MAX_STAMPS = 5;
        var stamps = [];
        var phrases = [
            "Te iubesc",
            "Te pup",
            "Te sărut",
            "Îmi e dor de tine",
            "Ești totul pentru mine",
            "Îmi ești dragă",
            "Te ador",
            "Ești viața mea",
            "Ești specială",
            "Te voi iubi mereu",
            "Ești minunată",
            "Inima mea e a ta",
            "Ești cea mai frumoasă",
            "Te iubesc nespus",
            "Mă gândesc la tine mereu",
            "Sunt norocos să te am",
            "De-abia aștept să te văd",
            "Te îmbrățișez",
            "Vom fi mereu împreună",
            "Ești tot ce mi-am dorit",
            "Lângă tine mă simt complet",
            "Ești sufletul meu pereche",
            "Tu ești fericirea mea",
            "Îmi place totul la tine",
            "Vreau să îmbătrânim împreună",
            "Îmi place să te aud râzând",
            "MA WAIF"
];
        var btn = document.getElementById("love-btn");
        var container = document.getElementById("stamps-container");
        if (!btn || !container) return;

        function getAvailablePhrase() {
            var used = stamps.map(function (s) {
                return s.dataset.phrase;
            });
            var available = phrases.filter(function (p) {
                return used.indexOf(p) === -1;
            });
            if (available.length === 0) available = phrases;
            return available[Math.floor(Math.random() * available.length)];
        }

        btn.addEventListener("click", function () {
            var phrase = getAvailablePhrase();
            var x = 5 + Math.random() * 45;
            var y = 5 + Math.random() * 55;
            var rot = Math.floor(Math.random() * 121) - 60;

            var el = document.createElement("span");
            el.className = "love-stamp";
            el.textContent = phrase;
            el.dataset.phrase = phrase;
            el.style.left = x + "%";
            el.style.top = y + "%";
            el.style.setProperty("--rot", rot + "deg");
            container.appendChild(el);
            stamps.push(el);

            if (stamps.length > MAX_STAMPS) {
                var old = stamps.shift();
                old.classList.add("removing");
                setTimeout(function () {
                    if (old.parentNode) old.parentNode.removeChild(old);
                }, 300);
            }
        });
    })();
})();
