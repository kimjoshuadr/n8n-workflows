import { workflow, node, links } from '@n8n-as-code/transformer';

// <workflow-map>
// Workflow : Calendar · Morning agenda
// Nodes   : 7  |  Connections: 5
//
// NODE INDEX
// ──────────────────────────────────────────────────────────────────
// Property name                    Node type (short)         Flags
// AboutThisWorkflow                  stickyNote
// Weekdays0730                       scheduleTrigger
// TodaySEvents                       googleCalendar             [creds] [alwaysOutput] [retry]
// LayOutTheDay                       code
// AnythingOn                         if
// PostTheAgenda                      slack                      [creds] [retry]
// ClearDay                           noOp
//
// ROUTING MAP
// ──────────────────────────────────────────────────────────────────
// Weekdays0730
//    → TodaySEvents
//      → LayOutTheDay
//        → AnythingOn
//          → PostTheAgenda
//         .out(1) → ClearDay
// </workflow-map>

// =====================================================================
// METADATA DU WORKFLOW
// =====================================================================

@workflow({
    id: undefined,
    name: 'Calendar · Morning agenda',
    active: undefined,
    settings: { executionOrder: 'v1', errorWorkflow: '__WF:error-handler__' },
})
export class CalendarMorningAgendaWorkflow {
    // =====================================================================
    // CONFIGURATION DES NOEUDS
    // =====================================================================

    @node({
        id: 'ebe0da05-131a-4eba-af4b-3ec672c4ceb2',
        name: 'About this workflow',
        type: 'n8n-nodes-base.stickyNote',
        version: 1,
        position: [-80, -210],
    })
    AboutThisWorkflow = {
        width: 640,
        height: 230,
        content: `## Calendar · Morning agenda
Posts today's meetings each weekday morning, with gaps and clashes pointed out, and stays silent on an empty day.

**Platforms:** Google Calendar, Slack
**Source and tests:** github.com/kimjoshuadr/n8n-workflows · \`workflows/operations\``,
    };

    @node({
        id: '1dc86708-c584-4810-a8dd-58d4f98b88cc',
        name: 'Weekdays 07:30',
        type: 'n8n-nodes-base.scheduleTrigger',
        version: 1.2,
        position: [0, 180],
    })
    Weekdays0730 = {
        rule: {
            interval: [
                {
                    field: 'cronExpression',
                    expression: '30 7 * * 1-5',
                },
            ],
        },
    };

    @node({
        id: '237f2632-7cd7-450a-adf5-1cf4761dfd4d',
        name: "Today's events",
        type: 'n8n-nodes-base.googleCalendar',
        version: 1.3,
        position: [260, 180],
        credentials: { googleCalendarOAuth2Api: { id: '__CRED:googleCalendar__', name: 'Google Calendar' } },
        alwaysOutputData: true,
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    TodaySEvents = {
        resource: 'event',
        operation: 'getAll',
        calendar: {
            __rl: true,
            mode: 'id',
            value: 'kim@example.com',
        },
        returnAll: true,
        timeMin: "={{ $now.startOf('day').toISO() }}",
        timeMax: "={{ $now.endOf('day').toISO() }}",
        options: {},
    };

    @node({
        id: 'e084fd54-3a9f-493f-abc6-04b9b9525606',
        name: 'Lay out the day',
        type: 'n8n-nodes-base.code',
        version: 2,
        position: [520, 180],
    })
    LayOutTheDay = {
        jsCode: `const events = $input.all().map((i) => i.json)
  .map((e) => ({ title: e.summary ?? "(no title)", start: e.start?.dateTime, end: e.end?.dateTime, declined: (e.attendees ?? []).some((a) => a.self && a.responseStatus === "declined") }))
  .filter((e) => e.start && e.end && !e.declined).sort((a, b) => new Date(a.start) - new Date(b.start));
const hm = (iso) => new Date(iso).toISOString().slice(11, 16);
const clashes = [];
for (let i = 1; i < events.length; i++) if (new Date(events[i].start) < new Date(events[i - 1].end)) clashes.push(events[i - 1].title + " / " + events[i].title);
const minutes = events.reduce((s, e) => s + (new Date(e.end) - new Date(e.start)) / 60000, 0);
const lines = events.map((e) => hm(e.start) + "-" + hm(e.end) + "  " + e.title);
return [{ json: { count: events.length, clashes, hours: Math.round(minutes / 6) / 10, text: lines.join("\\n") + (clashes.length ? "\\nClash: " + clashes.join("; ") : "") } }];`,
    };

    @node({
        id: '127c1634-01d9-40c8-a5cd-bb365b53db74',
        name: 'Anything on?',
        type: 'n8n-nodes-base.if',
        version: 2.2,
        position: [780, 180],
    })
    AnythingOn = {
        conditions: {
            options: {
                caseSensitive: true,
                leftValue: '',
                typeValidation: 'loose',
                version: 2,
            },
            conditions: [
                {
                    id: 'd111f171-b22f-4f9f-a91f-117be7f8db0b',
                    leftValue: '={{ $json.count > 0 }}',
                    rightValue: '',
                    operator: {
                        type: 'boolean',
                        operation: 'true',
                        singleValue: true,
                    },
                },
            ],
            combinator: 'and',
        },
        options: {},
    };

    @node({
        id: 'c10740c1-d42f-4c05-ad55-1c213a61958e',
        name: 'Post the agenda',
        type: 'n8n-nodes-base.slack',
        version: 2.3,
        position: [1040, 90],
        credentials: { slackApi: { id: '__CRED:slack__', name: 'Slack' } },
        retryOnFail: true,
        maxTries: 3,
        waitBetweenTries: 1000,
    })
    PostTheAgenda = {
        resource: 'message',
        operation: 'post',
        select: 'channel',
        channelId: {
            __rl: true,
            mode: 'name',
            value: "={{ '@me' }}",
        },
        text: "={{ ':calendar: ' + $json.count + ' meetings today, ' + $json.hours + 'h in total.\\n' + $json.text }}",
        otherOptions: {
            includeLinkToWorkflow: false,
        },
    };

    @node({
        id: '69f1be33-5bfe-49a6-a838-6ef69c2c902e',
        name: 'Clear day',
        type: 'n8n-nodes-base.noOp',
        version: 1,
        position: [1040, 270],
    })
    ClearDay = {};

    // =====================================================================
    // ROUTAGE ET CONNEXIONS
    // =====================================================================

    @links()
    defineRouting() {
        this.Weekdays0730.out(0).to(this.TodaySEvents.in(0));
        this.TodaySEvents.out(0).to(this.LayOutTheDay.in(0));
        this.LayOutTheDay.out(0).to(this.AnythingOn.in(0));
        this.AnythingOn.out(0).to(this.PostTheAgenda.in(0));
        this.AnythingOn.out(1).to(this.ClearDay.in(0));
    }
}
