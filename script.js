document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Element References ---
    const statLine1 = document.getElementById('stat-line1');
    const statLine2 = document.getElementById('stat-line2');
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
    const ledVisuals = {
        "Num_Lock": document.getElementById('led-Num_Lock'),
        "Caps_Lock": document.getElementById('led-Caps_Lock'),
        "Scroll_Lock": document.getElementById('led-Scroll_Lock')
    };

    const pauseMessageEl = document.getElementById('pause-message');
    const currentPromptMessageEl = document.getElementById('current-prompt-message');

    // --- Global Variables ---
    let appStartTime = Date.now();
    let showVisualButtons = true; // Default to true for web, 'H' key will be informational

    // --- LED Reaction Game State Variables ---
    const ledMapping = {
        "Num_Lock": "ArrowLeft",
        "Caps_Lock": "ArrowDown",
        "Scroll_Lock": "ArrowRight"
    };
    const ledNames = Object.keys(ledMapping);

    let currentLed = null;
    let ledTimerId = null; // For setTimeout
    let ledReactionTimes = [];
    let ledCorrectPresses = 0;
    let ledWrongPresses = 0;
    let ledTotalPresses = 0;
    let ledTime = 1000; // Reaction time window (ms)
    let ledStartTime = null;

    let ledGameStartTime = Date.now(); // When the current game round started
    let totalPauseDuration = 0.0;
    let activeGameTime = 0.0; // Time while unpaused (in seconds)
    let lastFrameTime = Date.now();

    let ledMissedPrompts = 0;
    let currentStreak = 0;
    let longestStreak = 0;
    let ledTotalPrompts = 0;

    let paused = true;
    let pauseStartTime = Date.now();

    const keysDown = new Set();

    // --- Helper Functions (Statistics) ---
    function getOrDefault(value, defaultValue = "N/A") {
        return (value !== null && !isNaN(value) && value !== undefined) ? value : defaultValue;
    }

    function formatDecimal(value, places = 2) {
        if (typeof value === 'number' && !isNaN(value)) {
            return value.toFixed(places);
        }
        return "N/A";
    }

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
        for (const ledName in ledVisuals) {
            ledVisuals[ledName].classList.remove('active');
        }
    }

    function activateVisualLed(ledName) {
        if (ledVisuals[ledName]) {
            ledVisuals[ledName].classList.add('active');
        }
    }
    
    function decreaseLedTime(current) {
        if (current > 100) return Math.max(1, current - 5);
        if (current > 50) return Math.max(1, current - 2);
        if (current > 1) return Math.max(1, current - 1);
        return 1;
    }

    function setNewLedTimer() {
        if (ledTimerId) clearTimeout(ledTimerId); // Clear existing timer
        ledTimerId = setTimeout(handleNewLedEvent, ledTime);
    }

    function handleNewLedEvent() {
        turnOffAllVisualLeds(); // Clear any remaining lights visually
        if (currentLed !== null) { // If an LED was active and timer expired, it's a miss
            ledMissedPrompts++;
            currentStreak = 0;
            // ledTime = decreaseLedTime(ledTime); // Already decreased when missed or timed out
        }
        
        currentLed = ledNames[Math.floor(Math.random() * ledNames.length)];
        activateVisualLed(currentLed);
        ledStartTime = Date.now();
        ledTotalPrompts++;
        setNewLedTimer(); // Set timer for this new LED
        updateUI();
    }
    
    function resetGame() {
        currentLed = null;
        if (ledTimerId) clearTimeout(ledTimerId);
        ledTimerId = null;
        ledReactionTimes = [];
        ledCorrectPresses = 0;
        ledWrongPresses = 0;
        ledTotalPresses = 0;
        ledTime = 1000;
        ledStartTime = null;
        
        // appStartTime remains
        totalPauseDuration = 0.0;
        activeGameTime = 0.0;
        lastFrameTime = Date.now(); // Reset for dt calculation

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
        statLine1.textContent = `Total Key Presses: ${ledTotalPresses} (Wrong: ${ledWrongPresses})`;
        statLine2.textContent = `Successful Presses: ${ledCorrectPresses} | Accuracy: ${getLedAccuracy()} | Prompts: ${ledTotalPrompts} (Prompt Ratio: ${getLedPromptRatio()})`;
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
        statCurrentLedTarget.textContent = `Target LED: ${currentLed || "N/A"}`;

        if (paused) {
            pauseMessageEl.textContent = "GAME PAUSED. Press SPACE to resume.";
            currentPromptMessageEl.textContent = "";
            turnOffAllVisualLeds(); // Ensure LEDs are off when paused display-wise
        } else {
            pauseMessageEl.textContent = "Press SPACE to Pause.";
            if (currentLed) {
                const keyName = ledMapping[currentLed].replace("Arrow", ""); // "Left", "Down", "Right"
                currentPromptMessageEl.textContent = `Press ${currentLed} (${keyName.toUpperCase()} ARROW)`;
            } else {
                currentPromptMessageEl.textContent = "Waiting for next LED...";
            }
        }
        visualLedArea.style.display = showVisualButtons ? 'flex' : 'none';
    }

    // --- Event Handlers ---
    function handleKeyDown(event) {
        if (keysDown.has(event.key)) return; // Prevent repeat firings from holding key
        keysDown.add(event.key);

        if (event.key === 'h' || event.key === 'H') {
            // showVisualButtons = !showVisualButtons; // In web, visual buttons are the game
            // For web, this is mostly informational as visual buttons are always "on" (the game itself)
            console.log("Visual buttons toggle (info only for web version)");
            updateUI();
            return;
        }

        if (event.key === 'r' || event.key === 'R') {
            resetGame();
            return;
        }

        if (event.key === ' ') { // Spacebar
            event.preventDefault(); // Prevent page scroll
            if (paused) {
                // Exiting pause
                totalPauseDuration += (Date.now() - pauseStartTime) / 1000;
                paused = false;
                lastFrameTime = Date.now(); // Reset for dt calculation
                turnOffAllVisualLeds();
                currentLed = null; // Ensure no LED is active from before pause
                if (ledTimerId) clearTimeout(ledTimerId);
                ledTimerId = null;
                setTimeout(handleNewLedEvent, 100); // Start new LED sequence shortly after unpausing
            } else {
                // Entering pause
                if (currentLed) {
                    // If an LED was active, it's now "missed" due to pause.
                    // Or, simply turn it off and don't penalize. Let's go with turn off.
                    turnOffAllVisualLeds();
                }
                currentLed = null;
                if (ledTimerId) clearTimeout(ledTimerId);
                ledTimerId = null;
                paused = true;
                pauseStartTime = Date.now();
            }
            updateUI();
            return;
        }

        if (paused || !currentLed) return; // Ignore game input if paused or no LED active

        const expectedKey = ledMapping[currentLed];
        if (Object.values(ledMapping).includes(event.key)) { // Only process game keys
            ledTotalPresses++;
            const reaction = Date.now() - ledStartTime;

            if (event.key === expectedKey) {
                if (reaction <= ledTime) { // Correct and within time
                    ledReactionTimes.push(reaction);
                    ledCorrectPresses++;
                    currentStreak++;
                    if (currentStreak > longestStreak) {
                        longestStreak = currentStreak;
                    }
                    ledTime = decreaseLedTime(ledTime);
                } else { // Correct but too late
                    ledMissedPrompts++; // Count as missed if too slow
                    currentStreak = 0;
                    // ledTime = decreaseLedTime(ledTime); // Decrease time even on late correct
                }
            } else { // Wrong key
                ledWrongPresses++;
                // ledMissedPrompts++; // A wrong press also means the current prompt was missed
                currentStreak = 0;
                // ledTime = decreaseLedTime(ledTime); // Decrease time on wrong press
            }
            
            // Common logic for any valid game key press (right or wrong) regarding current LED
            turnOffAllVisualLeds();
            currentLed = null;
            if (ledTimerId) clearTimeout(ledTimerId);
            ledTimerId = null;
            setTimeout(handleNewLedEvent, 100); // Schedule next LED quickly
            updateUI();
        }
    }

    function handleKeyUp(event) {
        keysDown.delete(event.key);
    }

    // --- Game Loop (for time updates and checks) ---
    function gameLoop() {
        const now = Date.now();
        const dt = (now - lastFrameTime) / 1000.0; // delta time in seconds
        lastFrameTime = now;

        if (!paused) {
            activeGameTime += dt;

            // Check for LED timeout if one is active and its timer hasn't fired yet
            // This is a failsafe; setTimeout should handle it, but good for robustness
            if (currentLed && ledStartTime && (now - ledStartTime) >= ledTime) {
                // This condition means the setTimeout for handleNewLedEvent should have fired.
                // If it didn't, or if we want to be more aggressive:
                console.log("Loop detected timeout for LED:", currentLed);
                turnOffAllVisualLeds();
                ledMissedPrompts++;
                currentStreak = 0;
                currentLed = null;
                if (ledTimerId) clearTimeout(ledTimerId);
                ledTimerId = null;
                ledTime = decreaseLedTime(ledTime); // Decrease time on miss
                setTimeout(handleNewLedEvent, 100); // Schedule next
            }
        }
        
        updateUI(); // Continuously update UI for timers etc.
        requestAnimationFrame(gameLoop);
    }

    // --- Initialization ---
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    resetGame(); // Set initial state (starts paused)
    requestAnimationFrame(gameLoop); // Start the game loop
});
