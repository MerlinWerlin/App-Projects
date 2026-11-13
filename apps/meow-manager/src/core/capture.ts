import { makeTask, type Task, type Language } from "./model.ts";

/** Small on-device parser. All proposals remain editable before saving. No cloud requests. */
export function capture(text: string, now: Date, language: Language): Task[] {
  return text
    .trim()
    .split(/\n+|;|；|。|\s+and (?:I (?:need to|have to)|remind me to)\s+/i)
    .filter(Boolean)
    .slice(0, 20)
    .map((part) => {
      let title = part.trim();
      const wantsReminder = /remind me|リマインド|知らせて/i.test(title);
      const date = new Date(now);
      date.setHours(17, 0, 0, 0);
      let dated = false;
      let fixed = false;
      const relative = title.match(
        /\bin\s+(\d{1,3})\s*(minutes?|mins?|hours?|hrs?)\b|(\d{1,3})(分|時間)後(?:に)?/i,
      );
      if (relative) {
        const amount = +(relative[1] ?? relative[3]);
        const unit = relative[2] ?? relative[4];
        const multiplier = /hour|hr|時間/i.test(unit) ? 60 : 1;
        if (amount > 0) {
          date.setTime(now.getTime() + amount * multiplier * 60_000);
          dated = true;
          fixed = true;
          title = title.replace(relative[0], "");
        }
      }
      const explicit = title.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
      if (explicit) {
        const candidate = new Date(
          +explicit[1],
          +explicit[2] - 1,
          +explicit[3],
          17,
        );
        if (
          candidate.getFullYear() === +explicit[1] &&
          candidate.getMonth() === +explicit[2] - 1 &&
          candidate.getDate() === +explicit[3]
        ) {
          date.setTime(candidate.getTime());
          dated = true;
          title = title.replace(explicit[0], "");
        }
      } else if (/\btomorrow\b|明日/.test(title.toLowerCase())) {
        date.setDate(date.getDate() + 1);
        dated = true;
        title = title.replace(/\b(?:by |on )?tomorrow\b|明日(?:の|に)?/i, "");
      } else if (/\btoday\b|今日/.test(title.toLowerCase())) {
        dated = true;
        title = title.replace(/\b(?:by |on )?today\b|今日(?:の|に)?/i, "");
      } else {
        const en = [
          "sunday",
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
        ];
        const ja = [
          "日曜日",
          "月曜日",
          "火曜日",
          "水曜日",
          "木曜日",
          "金曜日",
          "土曜日",
        ];
        const found = en.findIndex((d, i) =>
          new RegExp(
            `\\b${d}(?:s)?\\b|\\b${d.slice(0, 3)}\\b|${ja[i]}`,
            "i",
          ).test(title),
        );
        if (found >= 0) {
          let days = (found - now.getDay() + 7) % 7;
          if (/\bnext\b/i.test(title) && days === 0) days = 7;
          date.setDate(date.getDate() + days);
          dated = true;
          title = title.replace(
            new RegExp(
              `\\b(?:(?:by|on|next) )?(?:${en[found]}s?|${en[found].slice(0, 3)})\\b|${ja[found]}(?:の|に)?`,
              "i",
            ),
            "",
          );
        }
      }
      const time = title.match(
        /\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b|\bat\s+(\d{1,2}):(\d{2})\b|(\d{1,2})時(?:(\d{1,2})分)?(?:に)?/i,
      );
      if (time) {
        let hour = +(time[1] ?? time[4] ?? time[6]);
        const minute = +(time[2] ?? time[5] ?? time[7] ?? 0);
        const meridiem = time[3]?.toLowerCase();
        const valid = meridiem
          ? hour >= 1 && hour <= 12
          : hour >= 0 && hour < 24;
        if (valid && minute < 60) {
          if (meridiem) hour = (hour % 12) + (meridiem === "pm" ? 12 : 0);
          date.setHours(hour, minute, 0, 0);
          // A bare time already passed belongs to tomorrow. Explicit dates are never silently changed.
          if (!dated && date <= now) date.setDate(date.getDate() + 1);
          dated = true;
          fixed = true;
          title = title.replace(time[0], "");
        }
      }
      const duration = title.match(
        /\b(?:for\s+)?(\d{1,3})\s*(?:minutes?|mins?)\b|(\d{1,3})分(?:間)?/i,
      );
      const minutes = duration
        ? Math.max(5, Math.min(240, +(duration[1] ?? duration[2])))
        : 25;
      if (duration) title = title.replace(duration[0], "");
      const priority = /\b(urgent|important)\b|大事|重要|至急/i.test(title)
        ? "important"
        : "normal";
      title = title
        .replace(
          /^(?:please\s+)?(?:remind me\s+to|I need to|I have to|add task:?|add:)\s*/i,
          "",
        )
        .replace(/\s+/g, " ")
        .replace(/^[,\s]+|[,\s]+$/g, "");
      return makeTask(title || part.trim(), now, {
        minutes,
        priority,
        dueAt: dated ? date.toISOString() : null,
        fixed,
        remind: dated && wantsReminder,
      });
    });
}

export function smallSteps(title: string, language: Language): string[] {
  const ja = language === "ja";
  if (/assignment|essay|study|report|課題|勉強|レポート/i.test(title))
    return ja
      ? [
          "必要な資料を開く",
          "最初の小さな目標を決める",
          "10分だけ取り組む",
          "見直して次の一歩をメモする",
        ]
      : [
          "Open the notes or brief",
          "Choose one small part to finish",
          "Work on it for just 10 minutes",
          "Review it and note the next step",
        ];
  if (/clean|tidy|laundry|掃除|片付|洗濯/i.test(title))
    return ja
      ? [
          "必要な道具を出す",
          "小さな場所を一つ選ぶ",
          "10分だけ片付ける",
          "使った物を戻す",
        ]
      : [
          "Get the supplies ready",
          "Pick one small area",
          "Tidy for just 10 minutes",
          "Put the supplies away",
        ];
  if (/book|appointment|dentist|doctor|予約|歯医者|病院/i.test(title))
    return ja
      ? [
          "希望の日と時間を決める",
          "公式サイトや電話番号を確認する",
          "空きを確認して予約する",
          "確認できた日時をカレンダーに入れる",
        ]
      : [
          "Choose a few times that suit you",
          "Find the official website or phone number",
          "Check availability and make the booking",
          "Add the confirmed time to your calendar",
        ];
  if (/grocer|shop|buy|買い物|食材/i.test(title))
    return ja
      ? [
          "家にある物を確認する",
          "買う物のリストを作る",
          "買い物の時間を決める",
          "買った物をチェックする",
        ]
      : [
          "Check what you already have",
          "Write a short shopping list",
          "Choose a time to go",
          "Check things off as you shop",
        ];
  return ja
    ? [
        "終わりの形を一文で決める",
        "必要な物を用意する",
        "最初の一歩を5分だけ進める",
        "進んだ分を確認して次を決める",
      ]
    : [
        "Write down what finished looks like",
        "Get what you need ready",
        "Take the first step for five minutes",
        "Check your progress and choose what comes next",
      ];
}

export type Intent = "plan" | "overwhelmed" | "draft" | "capture";
export function intent(text: string): Intent {
  if (/overwhelm|too much|stressed|しんどい|つらい|多すぎ|疲れ/i.test(text))
    return "overwhelmed";
  if (
    /^(?:please\s+)?(?:plan|replan|organis[ez]|what.*(?:today|next)|予定を|今日の予定|計画)/i.test(
      text.trim(),
    )
  )
    return "plan";
  if (
    /^(?:draft|write (?:a |an )?(?:message|email)|メール|メッセージ)/i.test(
      text.trim(),
    )
  )
    return "draft";
  return "capture";
}
