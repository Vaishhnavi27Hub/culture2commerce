# Live demo script (3 minutes)

**Before you start:** run `npm run dev`, open http://localhost:3000, and check the badge at
the top right reads **Live Qloo data**. If it does not, the demo still works on fallback data;
say so honestly. Run Nisha's example once beforehand so you know today's result.

Numbers below are from the live run on 13 Oct 2026. Read the numbers on your screen, since
live data can change.

| Time | Do | Say |
|---|---|---|
| 0:00 | Show the input screen. | "Meet Nisha, a student in Bengaluru. She has ₹15,000 and two weekends, and three ideas: a thrift stall, art prints or a coffee pop-up. Ask a generic AI and you get pros and cons for all three, and 'it depends'." |
| 0:25 | Click **Try Nisha's example**. | "Culture2Commerce runs four agents. Watch them work live." |
| 0:35 | Point at agent 1 while it runs, then expand it. | "The Local Researcher asks Qloo for the most popular places in each locality. These anchor venues stand in for the people who actually spend time there. Every row here is a real Qloo call, with its parameters." |
| 1:00 | Expand agent 2. | "The Cultural Opportunity Finder sends those venues back to Qloo as a taste signal and asks: how strongly do art places, thrift stores and coffee shops resonate with this audience? Thirty live calls in total." |
| 1:20 | Point at agents 3 and 4. | "The Feasibility Critic costs every option against her budget. The Pilot Planner turns the winner into an experiment. These two make no Qloo calls; they judge what was found." |
| 1:30 | Click **See the recommendation**. | "One specific bet: an art print pop-up, in a named locality, for a named audience, with a pilot attached. Not a list." |
| 1:45 | Scroll to **Without Qloo vs With Qloo**. | "This is the difference. On the left, the generic answer. On the right, the grounded one, with the Qloo places and brand affinities that drove it." |
| 2:05 | Scroll to **All options, ranked**; show a rejected coffee option. | "Coffee actually has the highest cultural fit. But it is rejected: about twice her budget, mostly equipment rental and stock, and more than twenty competitors nearby. The reason is on the card." |
| 2:20 | Show **How the final score is computed** and the confidence panel. | "The score is a fixed formula with visible weights. No language model touches the numbers. And we never claim accuracy; we show a confidence level and why." |
| 2:35 | Click **See the pilot plan**. | "Quantities, prices, a schedule, a budget, and a rule: sell this many prints or make this much, and continue. Otherwise pivot or stop." |
| 2:50 | Enter results in **Report pilot results** and click **Get verdict**. | "After the pilot she reports what happened and gets predicted versus actual, and a verdict. From cultural signal to a tested business idea." |

## If something goes wrong

- **Badge says recorded or sample:** "The live API is unavailable right now, so the app has
  fallen back and labelled it. Confidence is capped because of that." Carry on.
- **An agent shows Failed:** expand it and read the reason. The run continues where it can.
- **Slow network:** a live run takes about 9 seconds. Repeats within 30 minutes are cached.
