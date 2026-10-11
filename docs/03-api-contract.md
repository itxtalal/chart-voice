# API contract

Frozen once Inam pushes the skeleton. Any change needs all three people to agree. If this file and the backend ever differ, the backend's live docs at http://localhost:8000/docs win, and this file gets fixed. The frontend types live in `frontend/src/api/types.ts` and must match.

Backend: http://localhost:8000. All paths start with `/api`.

| Method and path     | Request                                                                                   | Response                                 |
| ------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------- |
| `GET /api/health`   | none                                                                                      | `{"status": "ok", "model_loaded": true}` |
| `POST /api/analyze` | multipart/form-data: `image` (file), optional `chart_type` (`auto`, `bar`, `line`, `pie`) | AnalyzeResponse                          |
| `POST /api/ask`     | JSON AskRequest                                                                           | AskResponse                              |
| `POST /api/compare` | multipart/form-data: `image` (file)                                                       | CompareResponse                          |

Errors: HTTP 400 (bad input), 422 (validation), 500 or 503 (server or model problem), with body `{"detail": "human-readable message"}`. The frontend shows `detail` to the user, so keep it plain and helpful.

## AnalyzeResponse

```json
{
  "chart_type": "bar",
  "title": "Monthly sales 2025",
  "table": {
    "columns": ["Month", "Sales"],
    "rows": [
      ["Jan", 20],
      ["Feb", 25],
      ["Mar", 40],
      ["Apr", 38],
      ["May", 55]
    ]
  },
  "facts": {
    "series": [
      {
        "name": "Sales",
        "max": { "label": "May", "value": 55 },
        "min": { "label": "Jan", "value": 20 },
        "first": { "label": "Jan", "value": 20 },
        "last": { "label": "May", "value": 55 },
        "change_abs": 35,
        "change_pct": 175.0,
        "trend": "increasing",
        "biggest_rise": { "from": "Apr", "to": "May", "change": 17 },
        "biggest_drop": { "from": "Mar", "to": "Apr", "change": -2 },
        "total": 178,
        "shares": null
      }
    ]
  },
  "summary": "Sales rose from 20 in Jan to 55 in May. ...",
  "explanation": "This bar chart shows sales for each month. ...",
  "text_source": "llm",
  "warnings": [
    {
      "code": "llm_unavailable",
      "message": "AI explanation unavailable; showing a basic summary."
    }
  ],
  "timing_ms": { "extract": 6200, "llm": 900, "total": 7300 }
}
```

Rules:

- `table.rows` values are numbers or `null` (never strings), except the first column, which holds labels.
- `trend` is one of `increasing`, `decreasing`, `flat`, `mixed`.
- `shares` is `[{"label": "A", "percent": 42.5}]` for pie charts, else `null`.
- `text_source` is `llm` or `template`.
- `warnings` is an empty list when there is nothing to warn about.

Warning codes: `parse_failed`, `missing_values`, `non_numeric`, `shares_not_100`, `single_point`, `llm_unavailable`, `llm_numbers_unverified`.

The frontend shows `warnings[].message` to users as is, so write messages in plain language.

## AskRequest and AskResponse

The backend stores nothing, so the frontend sends the chart data back with every question. `history` holds at most the last 6 messages.

```json
{
  "question": "Which month had the biggest increase?",
  "title": "Monthly sales 2025",
  "chart_type": "bar",
  "table": {
    "columns": ["Month", "Sales"],
    "rows": [
      ["Jan", 20],
      ["Feb", 25]
    ]
  },
  "facts": { "series": [] },
  "history": [
    { "role": "user", "content": "What is the highest value?" },
    { "role": "assistant", "content": "May had the highest sales, 55." }
  ]
}
```

```json
{ "answer": "The biggest increase was from Apr to May, +17.", "on_topic": true }
```

When the question is unrelated to the chart, `on_topic` is `false` and `answer` politely says ChartVoice only answers questions about this chart.

## CompareResponse

```json
{
  "description": "The image shows a bar chart of monthly sales...",
  "model": "<groq vision model id>",
  "timing_ms": 1400
}
```

## Gaps worth raising with the team

- No units or axis labels in the response (e.g. "thousands", "%"). The summary and explorer would read better with them.
- Multi-series support isn't spelled out. The frontend already handles several value columns.
- Missing status codes for oversized (413) or wrong-type (415) uploads. The frontend checks both before upload anyway.
