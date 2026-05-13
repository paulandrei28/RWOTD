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
            showExhausted();
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
            showExhausted();
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
})();
