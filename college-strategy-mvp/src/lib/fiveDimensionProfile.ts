import type { FormState } from "../types";
import type { Locale } from "../i18n/strings";

export type ProfileDimensionKey = "academic" | "testing" | "activities" | "essays" | "strategy";

export type ProfileBand = "low" | "mid" | "high";

export type ProfileDimension = {
  key: ProfileDimensionKey;
  score: number;
  /** 一句话判断（结论优先） */
  judgment: string;
  /** 简要原因 */
  explain: string;
  /** 下一步建议 */
  suggest: string;
};

type BandCopy = {
  zh: { judgment: string; explain: string; suggest: string };
  en: { judgment: string; explain: string; suggest: string };
};

const BAND_COPY: Record<ProfileDimensionKey, Record<ProfileBand, BandCopy>> = {
  academic: {
    low: {
      zh: {
        judgment: "你目前成绩单信息偏薄，学术这一档我不好帮你压死。",
        explain: "成绩单这段现在偏「一句话带过」，顾问很难判断你的课程强度在招生官眼里站哪一档。",
        suggest: "把未加权/加权 GPA、年级排名（若有）、核心课列表和难度写进问卷第二步——不用长，但要能对照学校官网的 middle 50%。",
      },
      en: {
        judgment: "Right now your transcript notes are too thin to anchor an academic band with confidence.",
        explain: "Your transcript notes read thin—hard to place your rigor where admissions will actually bucket you.",
        suggest: "Add UW/W GPA, rank if you have it, and core courses with rigor (AP/IB/honors)—short is fine, but make it checkable against each school’s profile page.",
      },
    },
    mid: {
      zh: {
        judgment: "你目前有大致水平，但课程口径还没对齐，学术可信度会晃。",
        explain: "能看出大致水平，但还缺「和课程体系对齐」的那几笔，否则冲稳保里学术可信度会摇摆。",
        suggest: "补一句：你所在体系里 GPA 怎么算、有没有下滑/上升趋势；若有标化计划，写清首考/二考月份，方便把活动叙事和考试节奏对齐。",
      },
      en: {
        judgment: "There’s a signal, but curriculum context still isn’t tight enough for crisp tiering.",
        explain: "There’s a signal, but curriculum context is still a bit fuzzy—Reach/Match/Safety can wobble on academic credibility.",
        suggest: "Add one line on how GPA is calculated in your system and whether there’s an upward trend; if you’re testing, add test months so activities and timing line up.",
      },
    },
    high: {
      zh: {
        judgment: "你目前学术画像够清楚，可以正经拿去对齐学校区间了。",
        explain: "学术画像相对清楚：至少顾问能按「你这套课 + 这条成绩线」去对齐学校区间了。",
        suggest: "下一步把同一套信息压缩进活动/主文书里可核对的「证据点」：别重复堆数字，挑 2–3 个最能顶住追问的事实。",
      },
      en: {
        judgment: "Your academic picture is clear enough to align school bands without guessing.",
        explain: "Academic picture is clear enough to align school bands without guessing.",
        suggest: "Next, translate the same facts into 2–3 verifiable proof points for essays—don’t re-stack stats; pick what survives cross-examination.",
      },
    },
  },
  testing: {
    low: {
      zh: {
        judgment: "你目前标化这条是短板：要么没定策略，要么说要交分但数字没落地。",
        explain: "标化这条现在是短板：要么没选策略，要么说要交分但数字还没落地。",
        suggest: "先定「交不交」和考试月份，再把目标区间写进问卷；如果坚定 Test-Optional，就把为什么能在别处补强度写清楚，别留空让模型猜。",
      },
      en: {
        judgment: "Testing is your weak link—policy unset, or submit chosen but scores aren’t real yet.",
        explain: "Testing is the weak link right now—either the strategy isn’t set, or you chose to submit but scores aren’t in yet.",
        suggest: "Pick submit vs optional and test months, then add a target band if submitting; if test-optional, write one sentence on what replaces the score signal.",
      },
    },
    mid: {
      zh: {
        judgment: "你目前标化策略有了，但分数与送分节奏还没写死，核对会偏保守。",
        explain: "策略有了，但分数或送分节奏还没写死，名单里「验证型材料」会偏保守。",
        suggest: "把已出分/计划出分和送分学校清单写进备注里；哪怕只是月份，也能让顾问把核对重点从「猜」改成「查」。",
      },
      en: {
        judgment: "Policy is set, but the score story isn’t nailed down—checklists stay conservative.",
        explain: "Policy is chosen, but the score story isn’t nailed down yet—verification will skew conservative.",
        suggest: "Add what’s scored vs planned and rough send timing; even months shift checklist items from guesswork to concrete checks.",
      },
    },
    high: {
      zh: {
        judgment: "你目前标化信息基本闭环，可以进入「核对送分细节」阶段了。",
        explain: "标化信息基本闭环：至少「交不交 + 大致区间」是站得住的。",
        suggest: "去 College Board / ACT 官网核对送分代码与加急规则；把最容易踩坑的两条写进自己的表格，别交给申请季当天再查。",
      },
      en: {
        judgment: "Testing reads coherent—submit vs optional and the rough band are anchored.",
        explain: "Testing reads coherent—submit vs optional and the rough band are anchored.",
        suggest: "Double-check score-send codes and rush rules on official sites; copy two gotchas into your own tracker instead of rediscovering them at submit time.",
      },
    },
  },
  activities: {
    low: {
      zh: {
        judgment: "你目前活动几乎是空的——不是没亮点，是没法帮你挡「模板化」风险。",
        explain: "活动几乎是空的——不是「没亮点」，是顾问没法帮你挡掉「模板化」风险。",
        suggest: "先写 3 条：时间跨度、你具体做了什么、有没有可验证结果（人数/金额/名次）。不用文学化，写事实就能抬分。",
      },
      en: {
        judgment: "Activities are basically empty—hard to defend you against generic-essay risk.",
        explain: "Activities are basically empty—hard to defend you against generic essay risk.",
        suggest: "Drop three bullets: time span, what you did, and a verifiable outcome (people, dollars, rank). Facts first, storytelling later.",
      },
    },
    mid: {
      zh: {
        judgment: "你目前有活动，但更像罗列清单，主线不够尖。",
        explain: "有材料，但还偏「罗列」，看不出哪一条是你真正押重注的主线。",
        suggest: "标出 1 条主线 + 1 条辅线：主线写深（每周几小时、持续多久），辅线一笔带过，别让招生官自己帮你剪枝。",
      },
      en: {
        judgment: "You have activity lines, but it reads like a list—no obvious main thread yet.",
        explain: "There’s material, but it reads like a list—your main thread isn’t obvious yet.",
        suggest: "Name one primary thread + one secondary; deepen hours/week and duration on the primary, keep the secondary thin.",
      },
    },
    high: {
      zh: {
        judgment: "你目前活动够具体，能支撑「你不是临时凑简历」。",
        explain: "活动信息够具体，至少能支撑「你不是临时凑简历」这一判断。",
        suggest: "把同一条主线拆成主文书里 2 个场景 + 1 个失败/反思——比再堆一个新活动更能抬录取叙事。",
      },
      en: {
        judgment: "Activities are concrete enough to show this wasn’t built last month.",
        explain: "Activities are concrete enough to support “this wasn’t built last month.”",
        suggest: "Turn the main thread into two scenes + one failure/reflection in the personal statement—usually beats adding a brand-new activity.",
      },
    },
  },
  essays: {
    low: {
      zh: {
        judgment: "你目前文书素材偏薄，动笔很容易写成「漂亮但不贴你」。",
        explain: "文书潜力现在主要靠猜：活动没写细、专业意向也薄，很难判断你能写出哪种「可信成长弧」。",
        suggest: "先把活动和主申方向补实，再动笔；否则写出来的稿子容易「漂亮但不贴你」。",
      },
      en: {
        judgment: "Essay material is thin—drafts risk sounding polished but not attached to you.",
        explain: "Essay potential is guessy—thin activities + thin major intent makes a believable arc hard to see.",
        suggest: "Fill activities and major intent before drafting; otherwise the essay tends to sound polished but not attached to you.",
      },
    },
    mid: {
      zh: {
        judgment: "你目前有素材，但叙事脊骨还没露出来，容易变履历复述。",
        explain: "素材够了，但还没看到「冲突—选择—代价」这条叙事脊骨，文书容易写成履历复述。",
        suggest: "用 5 句话写：你曾相信什么、哪件事推翻它、你做了什么选择、付出什么、现在怎么看自己——这比形容词有用。",
      },
      en: {
        judgment: "You have ingredients, but the spine—tension, choice, cost—isn’t visible yet.",
        explain: "You have ingredients, but the spine—tension, choice, cost—isn’t visible yet; drafts often become resume rewrites.",
        suggest: "Write five sentences: what you believed, what broke it, what you chose, what it cost, and how you see yourself now—beats adjectives.",
      },
    },
    high: {
      zh: {
        judgment: "你目前文书可写性不错，剩下主要是取舍和语气。",
        explain: "文书素材的「可写性」不错：有事实、有时间线，剩下是取舍和语气问题。",
        suggest: "找一版你信任的人只问一句：「哪一段最像我？」删掉不像你的段落，比再加一个奖项更值钱。",
      },
      en: {
        judgment: "Essay material is workable—what’s left is taste and cuts.",
        explain: "Essay material is workable—facts and a timeline exist; what’s left is taste and cuts.",
        suggest: "Ask one trusted reader: “Which paragraph sounds most like me?” Cut what doesn’t pass—usually beats adding another award.",
      },
    },
  },
  strategy: {
    low: {
      zh: {
        judgment: "你目前选校策略还没落地，名单容易飘、风险不好兜。",
        explain: "选校风格、地理或底线几乎没落地——策略层现在是「空架子」。",
        suggest: "先把风险档位（冲/稳/保）和地理偏好选实；底线哪怕写一条「绝对不去」也比空着强，能立刻收窄名单噪音。",
      },
      en: {
        judgment: "List posture isn’t grounded yet—strategy is still mostly a shell.",
        explain: "List posture, geo, or dealbreakers aren’t grounded—strategy is still a shell.",
        suggest: "Lock risk posture and geo prefs; even one hard dealbreaker shrinks noisy list drift faster than adding another reach name.",
      },
    },
    mid: {
      zh: {
        judgment: "你目前有方向，但预算/拍板人没写清，后面一加压名单会摇摆。",
        explain: "大方向有，但家庭约束/预算口径还没写清，后面一加压名单就容易摇摆。",
        suggest: "把「谁拍板预算」「奖助学金是否一票否决」写进补充说明；顾问才能把保底写成真保底，而不是心理安慰。",
      },
      en: {
        judgment: "Direction exists, but budget decision-makers aren’t explicit—lists wobble under pressure.",
        explain: "Direction exists, but budget decision-makers aren’t explicit—lists wobble when pressure hits.",
        suggest: "Note who owns the budget call and whether aid is a hard gate—so safety schools read like real floors, not vibes.",
      },
    },
    high: {
      zh: {
        judgment: "你目前策略输入够扎实，可以拿去对照官网逐条核了。",
        explain: "策略输入比较完整：风险偏好、地理和底线至少有一条能拽住名单。",
        suggest: "下一步用你自己的表把每所学校的「官网 3 个必核项」抄出来——比再讨论「冲不冲」更能推进决策。",
      },
      en: {
        judgment: "Strategy inputs are solid enough to steer the list with discipline.",
        explain: "Strategy inputs are solid enough—risk, geo, or dealbreakers can actually steer the list.",
        suggest: "Copy three must-check official items per school into your tracker—that moves the family conversation faster than more Reach debate.",
      },
    },
  },
};

function bandForScore(score: number): ProfileBand {
  if (score < 46) return "low";
  if (score < 66) return "mid";
  return "high";
}

function scoreAcademic(form: FormState): number {
  const g = form.gpa.trim();
  if (!g) return 34;
  let s = 50;
  const len = g.length;
  if (len < 28) s = 46;
  else if (len < 85) s = 58;
  else if (len < 160) s = 68;
  else s = 74;
  if (/\d\.\d/.test(g)) s += 7;
  if (/rank|排名|top|前|\bUW\b|\bW\b|unweighted|weighted|未加权|加权|AP|IB|honors|course|课程/i.test(g)) s += 10;
  return Math.min(94, Math.max(30, s));
}

function parseSatish(s: string): number | null {
  const d = s.replace(/\D/g, "");
  if (d.length < 3) return null;
  const n = Number(d.slice(0, 4));
  if (n >= 400 && n <= 1600) return n;
  return null;
}

function parseActish(s: string): number | null {
  const d = s.replace(/\D/g, "");
  if (!d) return null;
  const n = Number(d.slice(0, 2));
  if (n >= 10 && n <= 36) return n;
  return null;
}

function scoreFromCurve(value: number, points: Array<[number, number]>): number {
  const sorted = [...points].sort((a, b) => a[0] - b[0]);
  if (value <= sorted[0][0]) return sorted[0][1];
  for (let i = 1; i < sorted.length; i += 1) {
    const [x2, y2] = sorted[i];
    const [x1, y1] = sorted[i - 1];
    if (value <= x2) {
      const ratio = (value - x1) / (x2 - x1);
      return y1 + ratio * (y2 - y1);
    }
  }
  return sorted[sorted.length - 1][1];
}

function scoreTesting(form: FormState): number {
  if (!form.testing) return 36;
  if (form.testing === "test_optional") {
    let s = 56;
    if (form.gpa.trim().length > 60) s += 6;
    return Math.min(82, s);
  }
  const has = Boolean(form.satScore.trim() || form.actScore.trim());
  if (!has) return 42;
  const sat = parseSatish(form.satScore);
  const act = parseActish(form.actScore);
  const candidates: number[] = [];
  if (sat != null) {
    candidates.push(
      scoreFromCurve(sat, [
        [400, 40],
        [1100, 54],
        [1250, 62],
        [1380, 70],
        [1450, 78],
        [1520, 86],
        [1600, 93],
      ]),
    );
  }
  if (act != null) {
    candidates.push(
      scoreFromCurve(act, [
        [10, 40],
        [22, 54],
        [25, 62],
        [28, 70],
        [31, 78],
        [34, 86],
        [36, 93],
      ]),
    );
  }
  if (candidates.length === 0) return 50;
  return Math.min(93, Math.max(40, Math.round(Math.max(...candidates))));
}

function scoreActivities(form: FormState): number {
  const a = form.activities.trim();
  if (!a) return 38;
  let s = 46;
  const len = a.length;
  if (len < 70) s = 50;
  else if (len < 200) s = 62;
  else s = 72;
  if (/lead|chair|captain|founder|president|national|international|research|paper|专利|主席|队长|创始人|国家|国际|科研/i.test(a)) s += 12;
  return Math.min(92, Math.max(32, s));
}

function scoreEssays(form: FormState): number {
  let s = 46;
  const act = form.activities.trim();
  if (act.length > 140) s += 14;
  else if (act.length > 60) s += 8;
  if (form.majorPrimary.trim().length > 2) s += 10;
  if (form.testing === "test_optional") s += 8;
  if (form.highSchoolSystem) s += 4;
  return Math.min(90, Math.max(34, s));
}

function scoreStrategy(form: FormState): number {
  let s = 44;
  if (form.riskStyle === "balanced") s = 70;
  else if (form.riskStyle === "conservative") s = 66;
  else if (form.riskStyle === "aggressive") s = 68;
  if (form.budget) s += 8;
  if (form.geoPrefs.length >= 1) s += 6;
  if (form.geoPrefs.length >= 3) s += 4;
  if (form.dealbreakers.trim().length > 3) s += 8;
  if (form.schoolSize) s += 5;
  return Math.min(90, Math.max(36, s));
}

export function buildFiveDimensionProfile(form: FormState, locale: Locale): ProfileDimension[] {
  const keys: ProfileDimensionKey[] = ["academic", "testing", "activities", "essays", "strategy"];
  const scores: Record<ProfileDimensionKey, number> = {
    academic: scoreAcademic(form),
    testing: scoreTesting(form),
    activities: scoreActivities(form),
    essays: scoreEssays(form),
    strategy: scoreStrategy(form),
  };
  const pack = locale === "en" ? "en" : "zh";

  return keys.map((key) => {
    const score = Math.round(scores[key]);
    const band = bandForScore(score);
    const { judgment, explain, suggest } = BAND_COPY[key][band][pack];
    return { key, score, judgment, explain, suggest };
  });
}
