# Driver Drill stats: the team sheet

Every run that finishes in the [Driver Drill](https://mona-shores-ftc-robotics.github.io/Visualizer/drill/) is
sent to one shared Google Sheet as a row, with who drove it. Any laptop or phone running the drill adds to the
same sheet, so you can see each driver's runs and progress in one place.

The site has no server of its own. The sheet takes the rows through a small Google Apps Script attached to it.
Setting that up takes about 5 minutes, once, by whoever owns the team's Google account.

**Set up 26 Nov 2026:** the team's sheet is "Team Sim Stats", and its web app is the drill's `TEAM_SHEET_URL`, so
every laptop sends there. The steps below are for setting it up again (a new sheet or a new deployment).

## Set it up (once)

1. **Make the sheet.** In the team's Google Drive, create a new Google Sheet, for example "Driver Drill stats".
2. **Add the script.**
   - In the sheet, open **Extensions → Apps Script**.
   - Delete what's in the editor and paste in all of
     [`docs/drill-stats.apps-script.gs`](drill-stats.apps-script.gs).
   - Click **Save**.
3. **Deploy it as a web app.**
   - Click **Deploy → New deployment**.
   - Next to "Select type", click the gear and choose **Web app**.
   - Set **Execute as: Me** and **Who has access: Anyone**.
   - Click **Deploy**, and approve the permissions Google asks for. It only needs this spreadsheet.
   - Copy the **Web app URL**. It looks like `https://script.google.com/macros/s/…/exec`.
4. **Check it.** Open the URL in a browser. It should say "Driver Drill stats: ready".
5. **Point the drill at it.**
   - **For every laptop:** send the URL to whoever maintains the Visualizer. They set it as `TEAM_SHEET_URL`
     in `src/drill/stats.ts`, and every laptop sends there from then on.
   - **Right away, on one laptop:** open the drill once as
     `https://mona-shores-ftc-robotics.github.io/Visualizer/drill/?stats=<the web app URL>`. That browser
     remembers it.

The first run that arrives creates a **Runs** tab with a header row.

## Using it

- Type the **Driver** (and **Operator**, when there is one) at the top of the drill. Each laptop remembers the
  names it has seen and offers them next time.
- In an alliance run, type both names separated by a comma, for example "Sam, Alex".
- Each finished run is sent as soon as it ends. The results card says whether it went. A run that couldn't go,
  because the laptop was offline or no sheet was set up yet, waits on that laptop and goes with the next run.
- **Send saved runs to the team sheet** (in the side panel) sends the runs already saved on that laptop,
  including ones from before names were asked. Those rows have no driver name and fewer columns. A run already
  sent is never added twice.

## The columns

| Column                                | What it is                                                                                                       |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| id                                    | the run's id: the laptop and the time it finished (a run sent twice is kept once)                                |
| date                                  | when the run finished (UTC)                                                                                      |
| driver, operator                      | as typed on the page                                                                                             |
| robot                                 | 20245 or 19429 (both in an alliance run)                                                                         |
| players                               | driver only, driver + operator, or an alliance mode                                                              |
| match                                 | the 2:00 drill and its opening (for example "2:00 from r-solo (1 TIP, 6 in CELL)"), or a full match and its Auto |
| field                                 | empty, or a match and the opponents' skill                                                                       |
| intake                                | POLLEN only, or the colour gate                                                                                  |
| cornerWheels                          | on or off                                                                                                        |
| totalTips, autoTips, teleopTips       | TIPs: all, from the Auto or opening, and in TeleOp                                                               |
| reached7                              | whether the run reached 7 TIPs                                                                                   |
| seventhAtS                            | seconds into TeleOp when the 7th TIP settled                                                                     |
| balls, cycles                         | balls launched, and cycles timed                                                                                 |
| bestCycleS, medianCycleS, bestPickUpS | the practice readout's best and median cycle, and best pick-up, in seconds                                       |
| nectarEntered                         | NECTAR the human player entered                                                                                  |
| opponentsTips                         | the opponents' TIPs, in a match field                                                                            |
| laptop                                | a random name for the browser it came from                                                                       |
| source                                | "drill", or "saved on this laptop" for a run sent from the saved history                                         |

## A summary per driver

Add a tab named **Drivers** and put this in cell A1:

```
=QUERY(Runs!A:X, "select C, count(A), avg(K), max(K), avg(S), min(R) where C is not null and C <> '' group by C label count(A) 'runs', avg(K) 'avg TIPs', max(K) 'best TIPs', avg(S) 'avg median cycle (s)', min(R) 'best cycle (s)'", 1)
```

It gives each driver's run count, average and best TIPs, average median cycle and best cycle. Compare like
with like: a full match counts its Auto's TIPs too, so filter on `match` (column G) or `players` (column F) for
a fair table, for example by adding `and G starts with '2:00'` after `C <> ''`.

## Privacy and limits

- The sheet holds the names typed into the drill. Keep it shared with the team only.
- The web app URL lets anyone who has it **add** rows, but not read the sheet. It sits in the Visualizer's
  public code once set as `TEAM_SHEET_URL`. If junk rows ever show up, deploy a new version of the script
  (a new URL) and update `TEAM_SHEET_URL`.
- Only runs that finish are recorded, as before: a run reset partway is not.
