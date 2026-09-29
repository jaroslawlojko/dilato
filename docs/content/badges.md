# Badges — content source

- **Source:** `stylebook/project/Achievements.dc.html`
- **Rules:** spec §4.9
- **English:** drafted, needs native-speaker review.

Each badge is earned once and **can never be lost**. Threshold badges count the challenge clock including overtime.

## Threshold badges

Tier = sky level and colour:

| Tier | Colour |
|---|---|
| Świt (Dawn) | Brzask |
| Ranek (Morning) | Złoty ranek |
| Pełne słońce (Full sun) | Mięta |
| Horyzont (Horizon) | Atrament |

| Key | Threshold | Tier | MVP | Name PL | Description PL | Name EN | Description EN |
|---|---|---|---|---|---|---|---|
| `t_5m` | 5 min | Świt | bonus¹ | Pierwsza chwila | Pięć minut, które należały do Ciebie. | First moment | Five minutes that were all yours. |
| `t_10m` | 10 min | Świt | bonus¹ | Dziesięć spokojnych | Dziesięć minut. Każda to duży krok. | Ten calm minutes | Ten minutes. Each one a big step. |
| `t_15m` | 15 min | Świt | yes | Pierwszy krok | Pierwsze odroczenie. Najtrudniejsze za Tobą. | First step | Your first delay. The hardest part is behind you. |
| `t_30m` | 30 min | Świt | yes | Fala przeczekana | Głód przyszedł i odpłynął. Bez Ciebie. | Wave outlasted | The craving came and went. Without you. |
| `t_45m` | 45 min | Świt | yes | Trzy kwadranse | Poranna kawa wypita bez papierosa. | Three quarters | Morning coffee, no cigarette. |
| `t_1h` | 1 h | Ranek | yes | Godzina dla siebie | Cała godzina odzyskana z nawyku. | An hour for you | A whole hour won back from the habit. |
| `t_2h` | 2 h | Ranek | yes | Spokojny poranek | Dwie godziny spokoju od rana. | Calm morning | Two peaceful hours from the start of the day. |
| `t_3h` | 3 h | Ranek | yes | Trzy godziny ciszy | Głód słabnie szybciej niż tydzień temu. | Three quiet hours | Cravings fade faster than a week ago. |
| `t_6h` | 6 h | Ranek | yes | Do południa | Pół dnia z własnym oddechem. | Until noon | Half a day on your own breath. |
| `t_12h` | 12 h | Ranek | yes | Pół doby | Tlenek węgla we krwi wraca do normy. | Half a day | Carbon monoxide in your blood is back to normal. |
| `t_24h` | 24 h | Pełne słońce | yes | Pełna doba | Cały dzień bez pierwszego papierosa. | A full day | A whole day without the first cigarette. |
| `t_48h` | 48 h | Pełne słońce | wkrótce | Smak wraca | Jedzenie smakuje wyraźniej, zapachy są żywsze. | Taste returns | Food tastes clearer, smells are more vivid. |
| `t_72h` | 72 h | Pełne słońce | wkrótce | Trzy świty | Nikotyna opuściła organizm. Oddech lżejszy. | Three dawns | Nicotine has left your body. Breathing is lighter. |
| `t_7d` | 7 dni | Horyzont | wkrótce | Tydzień oddechu | Siedem poranków bez dymu. | A week of breath | Seven smoke-free mornings. |
| `t_14d` | 14 dni | Horyzont | wkrótce | Dwa tygodnie lekkości | Krążenie zaczyna się poprawiać. | Two light weeks | Circulation starts to improve. |
| `t_30d` | 30 dni | Horyzont | wkrótce | Miesiąc | Oddech głębszy, kaszel coraz rzadszy. | A month | Deeper breaths, less and less coughing. |
| `t_90d` | 90 dni | Horyzont | wkrótce | Pora roku | Trzy miesiące nowego rytmu. | A season | Three months of a new rhythm. |
| `t_365d` | 365 dni | Horyzont | wkrótce | Pełen obieg | Rok. Słońce zaszło za horyzont — i już tam zostało. | Full circle | A year. The sun went over the horizon — and stayed there. |

¹ Bonus badges exist only when short steps are available (profile `wake` or > 20 cigarettes/day). Their names and copy are **new** (not in the stylebook) and need owner approval.

"wkrótce" = shown locked with the label "wkrótce" / "coming soon" in the MVP, because the ladder caps at 24 h.

## Attitude badges

These reward behaviour, not just time.

| Key | Name PL | Rule PL (shown) | Name EN | Rule EN (shown) |
|---|---|---|---|---|
| `five_mornings` | Pięć poranków | 5 dni z rzędu z rozpoczętym wyzwaniem. | Five mornings | 5 days in a row with a challenge started. |
| `extra_time` | Dokładka | Po osiągnięciu celu dołożony czas. | Extra helping | Added time after reaching your goal. |
| `honesty` | Szczerość | Zapisany nieudany dzień i powrót następnego ranka. | Honesty | Logged a tough day and came back the next morning. |
| `new_record` | Nowy rekord | Najdłuższe odroczenie pobite. Zdobywana wielokrotnie. | New record | Longest delay beaten. Can be earned again and again. |
| `wave_master` | Mistrz fali | 3 razy ćwiczenie oddechu i wyzwanie utrzymane. | Wave master | Used the breathing exercise and kept going — 3 times. |
| `piggy_bank` | Skarbonka | Pierwsze 100 zł, które zostało w kieszeni. | Piggy bank | Your first €25 / $25 / £20 kept in your pocket. |

The Skarbonka threshold depends on the currency: 100 PLN · 25 EUR · 25 USD · 20 GBP. PL copy for other currencies is "Pierwsze 25 € …" etc.

## Celebration tiers

See spec §4.10.

| Tier | PL | EN |
|---|---|---|
| Small (minutes) | Toast u dołu ekranu, delikatna wibracja, łuk zapala się na złoto. | Toast at the bottom, light haptic, the arc turns gold. |
| Medium (hours) | Pełny ekran „Cel osiągnięty” z odznaką, korzyścią dla ciała i propozycją dogrywki. | Full "Goal reached" screen with the badge, body benefit and an overtime offer. |
| Large (24 h) | Animacja pełnego wschodu, list „od Twojego ciała”, karta do udostępnienia. | Full sunrise animation, a "letter from your body", a share card. |
