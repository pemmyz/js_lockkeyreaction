document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const statLine1 = document.getElementById('stat-line1');
    const statLine2 = document.getElementById('stat-line2');
    // ... (rest of stat lines)
    const statLine3 = document.getElementById('stat-line3');
    const statLine4 = document.getElementById('stat-line4');
    const statLine5 = document.getElementById('stat-line5');
    const statLine6 = document.getElementById('stat-line6');
    const statLine7 = document.getElementById('stat-line7');
    const statLine8 = document.getElementById('stat-line8');
    const statLine9 = document.getElementById('stat-line9');
    const statLine10 = document.getElementById('stat-line10');
    const statCurrentLedTarget = document.getElementById('stat-current-led-target');

    const visualLedArea = document.getElementById('visual-led-area');
    const ledVisualDOMElements = { // Renamed to avoid conflict with ledVisuals in Pygame
        "Num_Lock": document.getElementById('led-Num_Lock'),
        "Caps_Lock": document.getElementById('led-Caps_Lock'),
        "Scroll_Lock": document.getElementById('led-Scroll_Lock')
    };

    const pauseMessageEl = document.getElementById('pause-message');
    const currentPromptMessageEl = document.getElementById('current-prompt-message');

    // --- Global Variables ---
    let appStartTime = Date.now();
    let showVisualButtons = true;

    // --- LED Reaction Game State Variables ---
    const ledMapping = { // Maps LED Name to KeyboardEvent.key
        "Num_Lock": "ArrowLeft",
        "Caps_Lock": "ArrowDown",
        "Scroll_Lock": "ArrowRight"
    };
    const ledNames = Object.keys(ledMapping); // ["Num_Lock", "Caps_Lock", "Scroll_Lock"]

    let currentLedName = null; // Stores the "name" of the active LED, e.g., "Num_Lock"
    let ledTimerId = null;
    let ledReactionTimes = [];
    let ledCorrectPresses = 0;
    let ledWrongPresses = 0;
    let ledTotalPresses = 0;
    let ledTime = 1000;
    let ledStartTime = null;

    let ledGameStartTime = Date.now();
    let totalPauseDuration = 0.0;
    let activeGameTime = 0.0;
    let lastFrameTime = Date.now();

    let ledMissedPrompts = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let ledTotalPrompts = 0;

    let paused = true;
    let pauseStartTime = Date.now();

    const keysDown = new Set();

    // --- Helper Functions (Statistics - unchanged) ---
    function getOrDefault(value, defaultValue = "N/A") { /* ... */ }
    function formatDecimal(value, places = 2) { /* ... */ }
    function getLedFastest() { /* ... */ }
    function getLedSlowest() { /* ... */ }
    function getLedAverage() { /* ... */ }
    function getLedMedian() { /* ... */ }
    function getLedStdev() { /* ... */ }
    function getLedPercentile(p) { /* ... */ }
    function getLedPercentile25() { return getLedPercentile(25); }
    function getLedPercentile75() { return getLedPercentile(75); }
    function getLedAccuracy() { /* ... */ }
    function getLedPromptRatio() { /* ... */ }
    // (Copy the full statistics functions from the previous script.js)
    function getLedFastest() {
        return ledReactionTimes.length ? formatDecimal(Math.min(...ledReactionTimes)) : "N/A";
    }

    function getLedSlowest() {
        return ledReactionTimes.length ? formatDecimal(Math.max(...ledReactionTimes)) : "N/A";
    }

    function getLedAverage() {
        if (!ledReactionTimes.length) return "N/A";
        const sum = ledReactionTimes.reduce((a, b) => a + b, 0);
        return formatDecimal(sum / ledReactionTimes.length);
    }

    function getLedMedian() {
        if (!ledReactionTimes.length) return "N/A";
        const sorted = [...ledReactionTimes].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return formatDecimal(sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2);
    }

    function getLedStdev() {
        if (ledReactionTimes.length < 2) return "N/A";
        const n = ledReactionTimes.length;
        const mean = ledReactionTimes.reduce((a, b) => a + b, 0) / n;
        const variance = ledReactionTimes.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (n - 1);
        return formatDecimal(Math.sqrt(variance));
    }

    function getLedPercentile(p) {
        if (!ledReactionTimes.length) return "N/A";
        const sorted = [...ledReactionTimes].sort((a, b) => a - b);
        const k = (sorted.length - 1) * (p / 100);
        const f = Math.floor(k);
        const c = Math.min(f + 1, sorted.length - 1);
        if (f === c) return formatDecimal(sorted[Math.trunc(k)]);
        const d0 = sorted[f] * (c - k);
        const d1 = sorted[c] * (k - f);
        return formatDecimal(d0 + d1);
    }
    
    function getLedPercentile25() { return getLedPercentile(25); }
    function getLedPercentile75() { return getLedPercentile(75); }

    function getLedAccuracy() {
        if (ledTotalPresses > 0) {
            return `${formatDecimal((ledCorrectPresses / ledTotalPresses) * 100)}%`;
        }
        return "N/A";
    }

    function getLedPromptRatio() {
        if (ledTotalPrompts > 0) {
            const ratio = (ledCorrectPresses / ledTotalPrompts) * 100;
            return `${ledCorrectPresses}/${ledTotalPrompts} (${formatDecimal(ratio)}%)`;
        }
        return "N/A";
    }


    // --- LED Simulation & Game Logic ---
    function turnOffAllVisualLeds() {
        for (const ledDomName in ledVisualDOMElements) {
            ledVisualDOMElements[ledDomName].classList.remove('active');
        }
    }

    function activateVisualLed(ledName) { // ledName is "Num_Lock", etc.
        if (ledVisualDOMElements[ledName]) {
            ledVisualDOMElements[ledName].classList.add('active');
        }
    }
    
    function decreaseLedTime(current) {
        if (current > 100) return Math.max(1, current - 5);
        if (current > 50) return Math.max(1, current - 2);
        if (current > 1) return Math.max(1, current - 1);
        return 1;
    }

    function setNewLedTimer() {
        if (ledTimerId) clearTimeout(ledTimerId);
        ledTimerId = setTimeout(handleNewLedEventDueToTimeout, ledTime); // Renamed for clarity
    }

    function handleNewLedEventDueToTimeout() {
        turnOffAllVisualLeds();
        if (currentLedName !== null) { // If an LED was active and timer expired, it's a miss
            ledMissedPrompts++;
            currentStreak = 0;
            ledTime = decreaseLedTime(ledTime); // Penalize for miss
        }
        
        pickAndDisplayNewLed();
    }

    function pickAndDisplayNewLed() {
        currentLedName = ledNames[Math.floor(Math.random() * ledNames.length)];
        activateVisualLed(currentLedName);
        ledStartTime = Date.now();
        ledTotalPrompts++;
        setNewLedTimer(); // Set timer for this new LED
        updateUI();
    }
    
    function resetGame() {
        currentLedName = null;
        if (ledTimerId) clearTimeout(ledTimerId);
        ledTimerId = null;
        ledReactionTimes = [];
        ledCorrectPresses = 0;
        ledWrongPresses = 0;
        ledTotalPresses = 0;
        ledTime = 1000;
        ledStartTime = null;
        
        totalPauseDuration = 0.0;
        activeGameTime = 0.0;
        lastFrameTime = Date.now();

        ledMissedPrompts = 0;
        currentStreak = 0;
        longestStreak = 0;
        ledTotalPrompts = 0;
        
        paused = true;
        pauseStartTime = Date.now();
        keysDown.clear();
        
        turnOffAllVisualLeds();
        updateUI();
    }

    // --- UI Update Function ---
    function updateUI() {
        statLine1.textContent = `Total Inputs: ${ledTotalPresses} (Wrong: ${ledWrongPresses})`; // Changed "Key Presses" to "Inputs"
        statLine2.textContent = `Successful Inputs: ${ledCorrectPresses} | Accuracy: ${getLedAccuracy()} | Prompts: ${ledTotalPrompts} (Prompt Ratio: ${getLedPromptRatio()})`;
        statLine3.textContent = `Fastest: ${getLedFastest()} ms | Slowest: ${getLedSlowest()} ms | Average: ${getLedAverage()} ms`;
        statLine4.textContent = `Median: ${getLedMedian()} ms | Stdev: ${getLedStdev()} ms`;
        statLine5.textContent = `25th Percentile: ${getLedPercentile25()} ms | 75th Percentile: ${getLedPercentile75()} ms`;
        statLine6.textContent = `Current Streak: ${currentStreak} | Longest Streak: ${longestStreak}`;
        statLine7.textContent = `Missed Prompts: ${ledMissedPrompts}`;
        statLine8.textContent = `Reaction Time Window: ${ledTime} ms`;
        
        const overallTime = Math.floor((Date.now() - appStartTime) / 1000);
        const activeTimeDisplay = Math.floor(activeGameTime);
        statLine9.textContent = `Active Game Time (unpaused): ${activeTimeDisplay} s`;
        statLine10.textContent = `Overall Game Time: ${overallTime} s`;
        statCurrentLedTarget.textContent = `Target LED Name: ${currentLedName || "N/A"}`; // Displaying LED name directly

        if (paused) {
            pauseMessageEl.textContent = "GAME PAUSED. Press SPACE to resume.";
            currentPromptMessageEl.textContent = "";
            turnOffAllVisualLeds();
        } else {
            pauseMessageEl.textContent = "Press SPACE to Pause.";
            if (currentLedName) {
                const keyName = ledMapping[currentLedName].replace("Arrow", "");
                currentPromptMessageEl.textContent = `Target: ${keyName.toUpperCase()} ARROW / Click the lit LED`;
            } else {
                currentPromptMessageEl.textContent = "Waiting for next LED...";
            }
        }
        visualLedArea.style.display = showVisualButtons ? 'flex' : 'none';
    }

    // --- Central Input Processing Logic ---
    function processPlayerInput(activatedKeyOrLedName) { // Can be "ArrowLeft" or "Num_Lock"
        if (paused || !currentLedName) return;

        ledTotalPresses++;
        const reaction = Date.now() - ledStartTime;
        
        let inputMatchesTarget = false;
        // Check if input matches the current LED's expected key OR the LED's name (for clicks)
        if (ledMapping[currentLedName] === activatedKeyOrLedName || currentLedName === activatedKeyOrLedName) {
            inputMatchesTarget = true;
        }

        if (inputMatchesTarget) {
            if (reaction <= ledTime) { // Correct and within time
                ledReactionTimes.push(reaction);
                ledCorrectPresses++;
                currentStreak++;
                if (currentStreak > longestStreak) {
                    longestStreak = currentStreak;
                }
                ledTime = decreaseLedTime(ledTime);
            } else { // Correct target but too late
                ledMissedPrompts++;
                currentStreak = 0;
                // ledTime = decreaseLedTime(ledTime); // Optionally penalize time for slow correct
            }
        } else { // Wrong key or wrong LED clicked
            ledWrongPresses++;
            ledMissedPrompts++; // A wrong input also means the current prompt was missed
            currentStreak = 0;
            // ledTime = decreaseLedTime(ledTime); // Optionally penalize time for wrong input
        }
        
        // Common logic for any valid game input (right or wrong) regarding current LED
        turnOffAllVisualLeds();
        currentLedName = null;
        if (ledTimerId) clearTimeout(ledTimerId);
        ledTimerId = null;
        setTimeout(pickAndDisplayNewLed, 100); // Schedule next LED quickly
        updateUI();
    }


    // --- Event Handlers ---
    function handleKeyDown(event) {
        if (keysDown.has(event.key)) return;
        keysDown.add(event.key);

        if (event.key.toLowerCase() === 'h') {
            // Informational only for web
            console.log("Visual buttons toggle (info only for web version)");
            // showVisualButtons = !showVisualButtons; // Can be re-enabled if you want to hide them
            updateUI();
            return;
        }

        if (event.key.toLowerCase() === 'r') {
            resetGame();
            return;
        }

        if (event.key === ' ') {
            event.preventDefault();
            if (paused) {
                totalPauseDuration += (Date.now() - pauseStartTime) / 1000;
                paused = false;
                lastFrameTime = Date.now();
                turnOffAllVisualLeds();
                currentLedName = null;
                if (ledTimerId) clearTimeout(ledTimerId);
                ledTimerId = null;
                setTimeout(pickAndDisplayNewLed, 100);
            } else {
                if (currentLedName) turnOffAllVisualLeds();
                currentLedName = null;
                if (ledTimerId) clearTimeout(ledTimerId);
                ledTimerId = null;
                paused = true;
                pauseStartTime = Date.now();
            }
            updateUI();
            return;
        }

        // Check if the pressed key is one of the game action keys
        if (Object.values(ledMapping).includes(event.key)) {
            processPlayerInput(event.key);
        }
    }

    function handleKeyUp(event) {
        keysDown.delete(event.key);
    }

    // Add click listeners to visual LEDs
    for (const ledDomName in ledVisualDOMElements) { // e.g., ledDomName is "Num_Lock"
        ledVisualDOMElements[ledDomName].addEventListener('click', () => {
            // When an LED div is clicked, we pass its 'name' (like "Num_Lock")
            // to processPlayerInput.
            // processPlayerInput will then check if this clicked ledName matches currentLedName
            processPlayerInput(ledDomName);
        });
    }


    // --- Game Loop (for time updates) ---
    function gameLoop() {
        const now = Date.now();
        const dt = (now - lastFrameTime) / 1000.0;
        lastFrameTime = now;

        if (!paused) {
            activeGameTime += dt;

            // Timeout check (mostly as a backup, setTimeout should handle it)
            if (currentLedName && ledStartTime && (now - ledStartTime) >= ledTime) {
                // This means setNewLedTimer's timeout fired, or should have.
                // handleNewLedEventDueToTimeout will be called by the timer.
                // If for some reason the timer failed, this is a fallback.
                // To avoid double-processing, we ensure this doesn't preempt the timer too aggressively.
                // The primary handling is in handleNewLedEventDueToTimeout.
            }
        }
        
        updateUI(); // Continuously update UI for timers etc.
        requestAnimationFrame(gameLoop);
    }

    // --- Initialization ---
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    resetGame();
    requestAnimationFrame(gameLoop);
});
