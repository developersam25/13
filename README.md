# HomeList — Property listings demo

This workspace contains a simple single-page frontend and an optional Node/Express backend for storing property listings and uploaded images.

Quick start

1. Install dependencies:

```bash
npm install
```

2. Start the backend server (runs on port 3000):

```bash
npm start
```

4. Optionally seed the server database with sample properties:

```bash
npm run seed
```

3. Open the frontend:

- Open `index.html` in your browser, or
- Serve the folder and visit the page (recommended to avoid file:// issues).

Notes

- When the backend at `http://localhost:3000` is available the frontend will POST listings and images to the server. Otherwise it falls back to `localStorage`.
- Uploaded images are saved to `uploads/` and served at `/uploads/<filename>`.

Next steps

- Add user authentication and permissions for agents/landlords.
- Integrate a real database (Postgres, MongoDB) for production.
- Add unit tests and end-to-end tests.
