# Research Frontend

A lightweight company research dashboard built with React, TanStack Router, Axios, and styled-components.

## Overview

This frontend lets a sales or research user:

- Search for a company
- Start a live research stream from the backend API
- Watch each report section render as it arrives
- Review saved reports from the history sidebar
- Open, delete, and retry the report flow without a heavy UI framework

The app expects a backend at `VITE_API_URL` (default: `http://localhost:8000`).

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

## Notes

- Uses Axios for API calls
- Uses styled-components for the UI styling layer
- Keeps the visual design polished and modern without Tailwind or a large component library
- Uses a minimal dependency set for easier maintenance
