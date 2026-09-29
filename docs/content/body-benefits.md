# Body benefits — content source

- **Source:** `stylebook/project/Body.dc.html`
- **Rules:** spec §4.8
- **English:** drafted, needs native-speaker review.

> **LAUNCH BLOCKER:** Every card must have `medical_review: approved` before store submission. The content is indicative, based on public health materials (incl. WHO, NHS), and must be reviewed by a medical consultant.

## Writing rules

- Always hedge: "zwykle", "zaczyna", "mniej więcej" / "usually", "starts to", "roughly".
- Describe benefits only, never losses or risks of smoking.
- Each card = a fact + one sentence beginning "Dla Ciebie:" / "For you:".

## Cards

Unlocked by smoke-free time: max of the longest-ever and the live value.

| Key | Threshold | Medical review | Title PL | Fact PL | Dla Ciebie | Title EN | Fact EN | For you |
|---|---|---|---|---|---|---|---|---|
| `b_5m` | 5 min | pending | Fala mija | Pojedyncza fala głodu trwa zwykle kilka minut. Każda przeczekana fala osłabia nawyk. | Dowód, że głód odpływa sam. | The wave passes | A single craving wave usually lasts a few minutes. Every wave you outlast weakens the habit. | Proof that cravings fade on their own. |
| `b_20m` | 20 min | pending | Serce zwalnia | Tętno i ciśnienie zaczynają wracać do Twojego naturalnego poziomu. | Spokojniejszy start dnia. | Your heart slows | Heart rate and blood pressure start returning to your natural level. | A calmer start to the day. |
| `b_8h` | 8 h | pending | Więcej tlenu | Tlenek węgla we krwi spada mniej więcej o połowę, a tlen swobodniej dociera do mięśni i mózgu. | Tyle zwykle daje sama noc — rano startujesz z przewagą. | More oxygen | Carbon monoxide in your blood drops by roughly half, and oxygen reaches your muscles and brain more freely. | The night alone usually gives you this — you start the morning ahead. |
| `b_12h` | 12 h | pending | Krew w normie | Poziom tlenku węgla wraca do normalnego. Serce nie musi pracować ciężej, żeby dostarczyć tlen. | Więcej energii w drugiej połowie dnia. | Blood back to normal | Carbon monoxide returns to a normal level. Your heart doesn't have to work harder to deliver oxygen. | More energy in the second half of the day. |
| `b_24h` | 24 h | pending | Serce odpoczywa | Pierwsza pełna doba to wyraźna ulga dla układu krążenia. | Pierwszy dzień, który należy w całości do Ciebie. | Your heart rests | The first full day is clear relief for your circulatory system. | The first day that belongs entirely to you. |
| `b_48h` | 48 h | pending | Smak i węch wracają | Zakończenia nerwowe zaczynają się odbudowywać. | Kawa, świeży chleb, powietrze po deszczu — wyraźniejsze. | Taste and smell return | Nerve endings start to regrow. | Coffee, fresh bread, air after rain — all clearer. |
| `b_72h` | 72 h | pending | Oddychasz lżej | Nikotyna opuszcza organizm, oskrzela się rozluźniają, rośnie energia. | Głód bywa teraz najwyraźniejszy — to szczyt, dalej jest łatwiej. | Breathing easier | Nicotine leaves your body, airways relax, energy rises. | Cravings can peak now — it gets easier from here. |
| `b_2w` | 2–12 tyg. (unlock at 14 d) | pending | Lepsze krążenie | Krążenie się poprawia, a wydolność płuc rośnie. | Schody i szybki spacer przychodzą łatwiej. | Better circulation | Circulation improves and lung function increases. | Stairs and brisk walks come easier. |
| `b_1mo` | 1–9 mies. (unlock at 30 d) | pending | Płuca się oczyszczają | Rzęski w drogach oddechowych odbudowują się; kaszel i zadyszka słabną. | Głębszy oddech, rzadsze infekcje. | Lungs clear | The tiny hairs in your airways regrow; coughing and breathlessness ease. | Deeper breaths, fewer infections. |
| `b_1y` | 1 rok (unlock at 365 d) | pending | Serce na plusie | Ryzyko choroby wieńcowej spada mniej więcej o połowę w porównaniu z osobą palącą. | Rok, który zmienił kierunek. | Heart in the plus | Risk of coronary heart disease drops to roughly half that of a smoker. | A year that changed direction. |

The scale on S10 is conventional: equal spacing, while time grows exponentially.

## "Poza ciałem" (beyond the body)

Always visible, with live values.

| Key | Title PL | Text PL | Title EN | Text EN |
|---|---|---|---|---|
| `x_money` | W kieszeni | ≈ {amount} zostało w kieszeni — szacunek z ceny paczki. | In your pocket | ≈ {amount} kept in your pocket — estimated from your pack price. |
| `x_time` | Odzyskany czas | ≈ {minutes} min odzyskane (ok. 5 min na papierosa). | Time regained | ≈ {minutes} min regained (about 5 min per cigarette). |
| `x_smell` | Bez zapachu dymu | Ubrania i włosy dłużej pachną sobą. | No smoke smell | Clothes and hair smell like themselves for longer. |

`x_time` = cigarettes not smoked (spec §4.11) × 5 min.
