# Social intelligence scraper

**Five networks scraped each morning into the sheets a dashboard reads.**

**The problem.** Tracking how the brand's and its competitors' posts perform meant opening five networks and copying numbers by hand.

**What this does about it.** Apify tasks collect the posts for every tracked account, each post is routed by account, and every record lands in one format in a Google Sheet that Tableau reads.

One canvas of 47 nodes, 6 tested behaviours. Import the [reliability kit](../../shared) first: these workflows call it.

> **Built and run in production, rebuilt here on test data.** Node names, order, branches and loops follow the original canvas. What is inside each node was written again for this library, and every name that belonged to the business is a placeholder.

## Social intelligence · Omnichannel scraper

Every morning, Apify tasks collect posts from Instagram (posts and reels), X, TikTok, YouTube and Facebook for the brand's own accounts and its competitors'. Each post is routed by account and written to that account's Google Sheet, which is the source a Tableau dashboard reads.

- **Starts from:** Schedule
- **Platforms:** <img src="../../assets/platforms/apify.svg" width="16" height="16" alt=""> Apify &nbsp;·&nbsp; <img src="../../assets/platforms/googleSheets.svg" width="16" height="16" alt=""> Google Sheets
- **Nodes:** 47
- **Calls:** `error-handler`
- **Files:** [`social-intelligence-scraper.json`](social-intelligence-scraper.json) · [`social-intelligence-scraper.workflow.ts`](social-intelligence-scraper.workflow.ts)

```mermaid
flowchart LR
  n1rc576m(["schedule"])
  n1wib0k7["set_instagram_accounts"]
  n1k4pq78["scrape_post"]
  n6rx524{"switch_accounts_1"}
  n1w430y8["create_row_1"]
  n1w430y9["create_row_2"]
  n1w430ya["create_row_3"]
  n1w430yb["create_row_4"]
  n1w430yc["create_row_5"]
  n1w430yd["create_row_6"]
  n1k4qsf2["scrape_reel"]
  n4ugc5l[/"abort"/]
  nfb1vbu["get_dataset_1"]
  n6rx525{"switch_accounts_2"}
  n1w430ye["create_row_7"]
  n1w430yf["create_row_8"]
  n1w430yg["create_row_9"]
  n1fmc880["create_row_10"]
  n1fmc881["create_row_11"]
  n1fmc882["create_row_12"]
  n1kcyw7l["set_x_accounts"]
  n10m2ezo["split_accounts_1"]
  n1r8pizi["for_each_account_1"]
  nzds8fh["scrape_tweet"]
  n6rx526{"switch_accounts_3"}
  n1fmc883["create_row_13"]
  n1fmc884["create_row_14"]
  ni2ocp3["set_tiktok_accounts"]
  nv71ge6["scrape_tiktok"]
  n1fmc885["create_row_15"]
  n1nvf2o6["set_youtube_accounts"]
  n1cmb0bj["scrape_yt"]
  n6rx527{"switch_accounts_4"}
  n1fmc886["create_row_16"]
  n1fmc887["create_row_17"]
  nbcq6t7["set_facebook_accounts"]
  n10m2ezp["split_accounts_2"]
  n1r8pizj["for_each_account_2"]
  n1cmazuo["scrape_fb"]
  n85ucw8[/"abort1"/]
  nfb1vbv["get_dataset_2"]
  n17eli4y["set_postdate"]
  n6rx528{"switch_accounts_5"}
  n1fmc888["create_row_18"]
  n1fmc889["create_row_19"]
  n1fmc88v["create_row_20"]
  n1fmc88w["create_row_21"]
  n1rc576m --> n1wib0k7
  n1wib0k7 --> n1k4pq78
  n1k4pq78 --> n6rx524
  n6rx524 --> n1w430y8
  n6rx524 --> n1w430y9
  n6rx524 --> n1w430ya
  n6rx524 --> n1w430yb
  n6rx524 --> n1w430yc
  n6rx524 --> n1w430yd
  n1wib0k7 --> n1k4qsf2
  n1k4qsf2 --> n4ugc5l
  n4ugc5l --> nfb1vbu
  nfb1vbu --> n6rx525
  n6rx525 --> n1w430ye
  n6rx525 --> n1w430yf
  n6rx525 --> n1w430yg
  n6rx525 --> n1fmc880
  n6rx525 --> n1fmc881
  n6rx525 --> n1fmc882
  n1rc576m --> n1kcyw7l
  n1kcyw7l --> n10m2ezo
  n10m2ezo --> n1r8pizi
  n1r8pizi -->|each| nzds8fh
  nzds8fh --> n6rx526
  n6rx526 --> n1fmc883
  n1fmc883 --> n1r8pizi
  n6rx526 --> n1fmc884
  n1fmc884 --> n1r8pizi
  n6rx526 --> n1r8pizi
  n1rc576m --> ni2ocp3
  ni2ocp3 --> nv71ge6
  nv71ge6 --> n1fmc885
  n1rc576m --> n1nvf2o6
  n1nvf2o6 --> n1cmb0bj
  n1cmb0bj --> n6rx527
  n6rx527 --> n1fmc886
  n6rx527 --> n1fmc887
  n1rc576m --> nbcq6t7
  nbcq6t7 --> n10m2ezp
  n10m2ezp --> n1r8pizj
  n1r8pizj -->|each| n1cmazuo
  n1cmazuo --> n85ucw8
  n85ucw8 --> nfb1vbv
  nfb1vbv --> n17eli4y
  n17eli4y --> n6rx528
  n6rx528 --> n1fmc888
  n1fmc888 --> n1r8pizj
  n6rx528 --> n1fmc889
  n1fmc889 --> n1r8pizj
  n6rx528 --> n1fmc88v
  n1fmc88v --> n1r8pizj
  n6rx528 --> n1fmc88w
  n1fmc88w --> n1r8pizj
  n6rx528 --> n1r8pizj
```

**How it runs**

1. **One schedule, five networks.** Each morning the schedule starts a track for Instagram, X, TikTok, YouTube and Facebook at the same time. Each track starts from its own list of accounts.
2. **Instagram posts.** A saved Apify task scrapes the latest posts for all six accounts and hands back its dataset.
3. **Sorted by account.** A switch sends each post to the branch for the account it belongs to. A post from an account that is not on the list goes nowhere.
4. **Written to that account's sheet.** Each account has its own spreadsheet. A post already in the sheet is updated with today's numbers instead of being added twice.
5. **Instagram reels.** Reels run as a separate task with a time limit. The run is stopped through Apify's API, then whatever it collected is read and sorted the same way.
6. **X, one account at a time.** The X accounts are looped over. An account with nothing new hands the loop straight back so the next one still runs.
7. **TikTok and YouTube.** TikTok covers the brand's own account. YouTube covers the brand and one competitor, split by channel.
8. **Facebook, one page at a time.** Each page is scraped in turn. The post date is put in one format before the row is written, so the dashboard can chart every network on the same axis.

**Tested behaviour**

- writes each Instagram post to the sheet of the account it belongs to
- a post from an account that is not tracked is not written
- stops the reels run, then reads what it collected
- every X account is scraped even when one has nothing new
- writes tweets, TikTok and YouTube videos with one set of columns
- Facebook pages are scraped one at a time and the post date is normalised
