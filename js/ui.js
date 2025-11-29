import { state } from "./state.js";
import { Themes, BotPersonalities, CampaignLevels } from "./constants.js";
import { initializeGame } from "./gameLogic.js";

// ===== START SCREEN LOGIC =====
export function selectTheme(themeName) {
    state.currentTheme = Themes[themeName];

    // Update UI buttons
    const buttons = document.querySelectorAll(".theme-btn");
    buttons.forEach((btn) => {
        btn.classList.remove("selected");
        if (btn.textContent.toUpperCase() === themeName) {
            btn.classList.add("selected");
        }
    });
}

export function selectDifficulty(diffName) {
    state.currentDifficulty = BotPersonalities[diffName];

    // Update UI buttons
    const buttons = document.querySelectorAll(".diff-btn");
    buttons.forEach((btn) => {
        btn.classList.remove("selected");
        if (btn.textContent.toUpperCase() === diffName) {
            btn.classList.add("selected");
        }
    });
}

export function selectMode(mode) {
    const quickplayOptions = document.getElementById("quickplay-options");
    const campaignOptions = document.getElementById("campaign-options");
    const modeButtons = document.querySelectorAll(".mode-btn");

    modeButtons.forEach((btn) => {
        btn.classList.remove("selected");
        if (btn.textContent.toLowerCase().includes(mode)) {
            btn.classList.add("selected");
        }
    });

    if (mode === "campaign") {
        quickplayOptions.style.display = "none";
        campaignOptions.style.display = "block";
        state.isCampaignMode = true;
    } else {
        quickplayOptions.style.display = "block";
        campaignOptions.style.display = "none";
        state.isCampaignMode = false;
    }
}

export function startGame() {
    if (state.isCampaignMode) {
        // Start campaign from level 1
        state.currentCampaignLevel = 1;
        loadCampaignLevel(state.currentCampaignLevel);
    } else {
        // Quick Play - use selected theme and difficulty
        state.bot.personality = state.currentDifficulty;
        state.bot.K_FACTOR = state.currentDifficulty.kFactor;
        console.log(`🤖 Bot Updated to: ${state.bot.personality.name}`);
    }

    document.getElementById("start-screen").style.display = "none";
    document.getElementById("menu-btn").style.display = "block";
    state.isGameRunning = true;
    initializeGame();
}

export function loadCampaignLevel(levelNum) {
    const level = CampaignLevels[levelNum - 1];
    state.currentTheme = level.theme;
    state.currentDifficulty = level.difficulty;
    state.bot.personality = level.difficulty;
    state.bot.K_FACTOR = level.difficulty.kFactor;
    console.log(`🎮 Campaign Level ${levelNum}: ${level.name}`);
}

export function showLevelComplete() {
    setTimeout(() => {
        const nextLevel = state.currentCampaignLevel + 1;
        const nextLevelName = CampaignLevels[nextLevel - 1].name;

        document.getElementById(
            "victory-title"
        ).textContent = `🎉 Level ${state.currentCampaignLevel} Complete!`;
        document.getElementById(
            "victory-message"
        ).textContent = `Next: Level ${nextLevel} - ${nextLevelName}`;
        document.getElementById("victory-overlay").style.display = "flex";
    }, 1000);
}

export function showCampaignComplete() {
    setTimeout(() => {
        document.getElementById("campaign-complete-overlay").style.display = "flex";
    }, 1000);
}

export function showMissionFailed() {
    setTimeout(() => {
        document.getElementById("defeat-overlay").style.display = "flex";
    }, 1000);
}

// Overlay button handlers
export function continueToNextLevel() {
    document.getElementById("victory-overlay").style.display = "none";
    state.currentCampaignLevel++;
    loadCampaignLevel(state.currentCampaignLevel);
    initializeGame();
}

export function retryLevel() {
    document.getElementById("defeat-overlay").style.display = "none";
    initializeGame();
}

export function returnToMenu() {
    document.getElementById("victory-overlay").style.display = "none";
    document.getElementById("defeat-overlay").style.display = "none";
    document.getElementById("campaign-complete-overlay").style.display = "none";
    showMainMenu();
}

export function showMainMenu() {
    state.isGameRunning = false;
    document.getElementById("start-screen").style.display = "flex";
    document.getElementById("menu-btn").style.display = "none";
}
