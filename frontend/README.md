# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Frontend implementation notes (minimal)

### Recommended stack

- React (Vite) or Next.js (if you want SSR)
- UI: Tailwind or Chakra UI (optional)
- State: React Query for data fetching and polling, or SWR
- Build: Vite for fast dev

### Routing & pages

- /            → Dashboard (list sessions)
- /upload      → Upload page/modal
- /session/:id → Session detail + Document viewer + Q&A

### Key components

- UploadForm: requests presign, does PUT to S3, shows progress
- SessionList: fetches GET /sessions
- SessionDetail: polls GET /sessions/{id} for status and shows chunks
- ChatPane: calls POST /query and displays answers + citations

### Example fetch snippets

- Request presigned URL

  ```javascript
  // filepath: c:\Users\dan\Desktop\Lens\frontend\README.md
  // example: request presign
  async function getPresign(filename) {
    const res = await fetch(`${API_BASE}/presign?filename=${encodeURIComponent(filename)}`);
    return res.json(); // { session_id, upload_url, s3_key, expires_in }
  }
  ```

- Upload file to S3 (presigned URL)

  ```javascript
  // filepath: c:\Users\dan\Desktop\Lens\frontend\README.md
  async function uploadToS3(uploadUrl, file) {
    await fetch(uploadUrl, { method: "PUT", body: file });
  }
  ```

- Poll session status

  ```javascript
  // filepath: c:\Users\dan\Desktop\Lens\frontend\README.md
  async function pollSession(sessionId, onUpdate) {
    let status = null;
    while (status !== "READY_FOR_QUERY" && status !== "ERROR") {
      const res = await fetch(`${API_BASE}/sessions/${sessionId}`);
      const data = await res.json();
      onUpdate(data);
      status = data.status;
      if (status === "READY_FOR_QUERY" || status === "ERROR") break;
      await new Promise(r => setTimeout(r, 3000));
    }
  }
  ```

- Query API

  ```javascript
  // filepath: c:\Users\dan\Desktop\Lens\frontend\README.md
  async function querySession(sessionId, question, top_k=3) {
    const res = await fetch(`${API_BASE}/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: sessionId, query: question, top_k })
    });
    return res.json(); // { answer, citations }
  }
  ```

### Development checklist

- [ ] Wire API_BASE to environment config (Vite/CRA env)
- [ ] Implement UploadForm and direct S3 PUT
- [ ] Implement poll or websocket for parse completion
- [ ] Implement ChatPane with loading/error handling and citations UI
- [ ] Protect any admin routes; never embed API keys in frontend

### Deployment

- Build static bundle and host on S3 + CloudFront or Vercel/Netlify
- Configure CORS on API Gateway to accept frontend origin

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)
