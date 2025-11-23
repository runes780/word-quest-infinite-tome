
export const translations = {
    en: {
        settings: {
            title: "Settings",
            language: "Language",
            apiKey: "OpenRouter API Key",
            model: "AI Model",
            connect: "Connect",
            close: "Close",
            save: "Save",
            sound: "Sound Effects"
        },
        battle: {
            score: "SCORE",
            level: "LEVEL",
            xp: "XP",
            vs: "VS",
            hero: "HERO",
            boss: "BOSS",
            missionObjective: "Mission Objective",
            hint: "Hint",
            hideHint: "Hide Hint",
            victory: "VICTORY!",
            defeat: "DEFEAT!",
            analyze: "Analyze",
            nextLevel: "Next Level",
            summoning: "SUMMONING NEW CHALLENGERS...",
            inventoryEmpty: "Inventory Empty",
            rewards: "Victory Rewards",
            claim: "Claim",
            skip: "Skip",
            continue: "Continue",
            critical: "CRITICAL!",
            weakness: "WEAKNESS!",
            combo: "COMBO"
        },
        shop: {
            title: "Merchant",
            yourGold: "Your Gold",
            buy: "Buy",
            soldOut: "Sold Out",
            close: "Close",
            footer: "Earn gold by defeating monsters. Critical hits grant bonus gold!"
        },
        report: {
            missionAccomplished: "MISSION ACCOMPLISHED",
            missionFailed: "MISSION FAILED",
            victoryMessage: "The Infinite Tome has been secured.",
            defeatMessage: "The monsters were too strong this time.",
            finalScore: "Final Score",
            totalTargets: "Total Targets",
            missionDebrief: "Mission Debrief",
            mvpSkill: "MVP Skill:",
            weakness: "Weakness:",
            tacticalAnalysis: "Tactical Analysis:",
            generateAnalysis: "Generate Tactical Analysis",
            initializeNewMission: "Initialize New Mission"
        },
        mentor: {
            title: "Tactical Advisor Online",
            analyzing: "Analyzing combat data...",
            acceptChallenge: "Accept Revenge Challenge",
            error: "Communication link unstable. But remember: "
        },
        input: {
            title: "Mission Briefing",
            subtitle: "Upload study material to generate targets",
            placeholder: "Paste text from your textbook here...",
            configureKey: "Configure API Key to Start",
            analyzing: "Analyzing Intel...",
            initialize: "Initialize Mission",
            error: "Failed to generate mission. Please try again."
        },
        home: {
            title: "Word Quest",
            subtitle: "Infinite Tome",
            enterText: "Enter your study text here...",
            startMission: "Start Mission",
            loading: "Loading..."
        }
    },
    zh: {
        settings: {
            title: "设置",
            language: "语言",
            apiKey: "OpenRouter API 密钥",
            model: "AI 模型",
            connect: "连接",
            close: "关闭",
            save: "保存",
            sound: "音效"
        },
        battle: {
            score: "分数",
            level: "等级",
            xp: "经验",
            vs: "对决",
            hero: "英雄",
            boss: "首领",
            missionObjective: "任务目标",
            hint: "提示",
            hideHint: "隐藏提示",
            victory: "胜利！",
            defeat: "失败！",
            analyze: "分析",
            nextLevel: "下一关",
            summoning: "正在召唤新的挑战者...",
            inventoryEmpty: "背包为空",
            rewards: "胜利奖励",
            claim: "领取",
            skip: "跳过",
            continue: "继续",
            critical: "暴击！",
            weakness: "弱点击破！",
            combo: "连击"
        },
        shop: {
            title: "商店",
            yourGold: "你的金币",
            buy: "购买",
            soldOut: "售罄",
            close: "关闭",
            footer: "击败怪物赚取金币。暴击获得额外奖励！"
        },
        report: {
            missionAccomplished: "任务完成",
            missionFailed: "任务失败",
            victoryMessage: "无尽之书已安全。",
            defeatMessage: "这次的怪物太强了。",
            finalScore: "最终得分",
            totalTargets: "总目标",
            missionDebrief: "任务简报",
            mvpSkill: "最佳技能：",
            weakness: "弱点：",
            tacticalAnalysis: "战术分析：",
            generateAnalysis: "生成战术分析",
            initializeNewMission: "开始新任务"
        },
        mentor: {
            title: "战术顾问在线",
            analyzing: "正在分析战斗数据...",
            acceptChallenge: "接受复仇挑战",
            error: "通讯链路不稳定。但请记住："
        },
        input: {
            title: "任务简报",
            subtitle: "上传学习资料以生成目标",
            placeholder: "在此粘贴课本内容...",
            configureKey: "配置 API 密钥以开始",
            analyzing: "正在分析情报...",
            initialize: "初始化任务",
            error: "任务生成失败。请重试。"
        },
        home: {
            title: "单词大冒险",
            subtitle: "无尽之书",
            enterText: "在此输入你的学习文本...",
            startMission: "开始任务",
            loading: "加载中..."
        }
    }
};

export type Language = 'en' | 'zh';
