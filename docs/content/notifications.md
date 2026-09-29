# Notifications — content source

- **Source:** `stylebook/project/Method.dc.html`
- **Rules:** spec §7.1
- **English:** drafted, needs native-speaker review.

**Rare and kind. At most 4 per Dilato day.**

- **Priority when the cap is hit:** `goal` > `wake` / `after_break` > `five_left` > `half`.

| Key | When | PL | EN |
|---|---|---|---|
| `wake` | `reminder_time` on reminder days, if no challenge started today | Dzień dobry. Masz już {smokeFree} bez dymu. Odsuniesz pierwszego o {suggestion}? | Good morning. You're already {smokeFree} smoke-free. Push the first one back by {suggestion}? |
| `half` | 50% of target elapsed (targets ≥ 30 min) | Połowa za Tobą. Słońce jest wysoko. | Halfway there. The sun is high. |
| `five_left` | 5 min before target (targets ≥ 15 min) | Jeszcze 5 minut. Szklanka wody i gotowe. | 5 more minutes. A glass of water and you're there. |
| `goal` | at `target_at` | Udało się — {target}! Nowa odznaka czeka. | You did it — {target}! A new badge is waiting. |
| `after_break` | next morning after an interrupted day (replaces `wake`) | Wczorajsze {result} się liczą. Nowy świt, nowa próba? | Yesterday's {result} count. New dawn, another try? |

For `goal`: if no new badge was earned, the second sentence becomes "Zobacz, co zyskało ciało." / "See what your body gained."

## Never

- "Nie poddawaj się!" / "Don't give up!"
- "Znowu?" / "Again?"
- Death or disease statistics
- More than one exclamation mark
- Guilt, pressure or countdown-to-failure language
