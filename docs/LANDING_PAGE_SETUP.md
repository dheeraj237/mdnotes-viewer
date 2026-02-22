# Landing Page and Authentication Setup Guide

## Overview
This guide covers the setup of:
- Landing page with GrowthBook configuration
- Google OAuth authentication
- User profile management
- Demo mode

## Environment Variables

### Required Setup

1. **Copy the example environment file**:
   ```bash
   cp .env.example .env
   ```

2. **Configure the following variables in `.env`**:

#### NextAuth Configuration
```env
NEXTAUTH_SECRET=<your-secret>
NEXTAUTH_URL=http://localhost:3000
```

Generate a secret with:
```bash
openssl rand -base64 32
```

#### Google OAuth
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
6. Add to `.env`:
   ```env
   GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=<your-client-secret>
   ```

#### GrowthBook Configuration
1. Sign up at [GrowthBook](https://www.growthbook.io/)
2. Create a new project
3. Get your SDK endpoint and client key
4. Add to `.env`:
   ```env
   NEXT_PUBLIC_GROWTHBOOK_API_HOST=https://cdn.growthbook.io
   NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY=<your-client-key>
   ```

## GrowthBook Feature Flags

Configure these features in your GrowthBook dashboard to customize the landing page:

### Available Features

| Feature Key | Type | Default Value | Description |
|------------|------|---------------|-------------|
| `landing-title` | String | "Verve: Your Markdown Editor" | Main landing page title |
| `landing-description` | String | "A powerful markdown documentation editor..." | Landing page description |
| `show-demo-button` | Boolean | `true` | Show/hide the demo button |
| `show-login-button` | Boolean | `true` | Show/hide the login button |

### Setting Up Features in GrowthBook

1. Log into your GrowthBook dashboard
2. Navigate to Features
3. Create new features with the keys above
4. Set default values and configure targeting rules as needed
5. Publish changes

Example JSON configuration:
```json
{
  "landing-title": {
    "defaultValue": "Verve: Your Markdown Editor"
  },
  "landing-description": {
    "defaultValue": "A powerful markdown documentation editor with live preview, collaborative features, and intuitive navigation."
  },
  "show-demo-button": {
    "defaultValue": true
  },
  "show-login-button": {
    "defaultValue": true
  }
}
```

## Routes

### `/` - Landing Page
- Displays configurable title and description
- Demo button → redirects to `/editor` with sample files
- Login button → Google OAuth flow

### `/editor` - Editor Interface
- Full markdown editor with file explorer
- Available to all users (authenticated or not)
- Sample files pre-loaded in `/public/content/`

## User Profile Management

### Features
- **Theme Preference**: Light, dark, or system theme
- **Google Account Info**: Name, email, profile picture
- **Persistent Storage**: Zustand with localStorage persistence

### Accessing User Menu
- Click user avatar in top-right corner (when logged in)
- Options:
  - View profile info
  - Change theme preference
  - Log out

### User Store
Location: `core/store/user-store.ts`

Available state:
```typescript
{
  profile: UserProfile | null,
  preferences: {
    theme: "light" | "dark" | "system",
    editorFontSize: number,
    editorLineHeight: number
  }
}
```

## Development

### Running Locally
```bash
yarn dev
```

Visit:
- Landing page: http://localhost:3000
- Editor (direct): http://localhost:3000/editor

### Building for Production
```bash
yarn build
yarn start
```

## Authentication Flow

1. **User clicks "Login with Google"** on landing page
2. Redirected to Google OAuth consent screen
3. After approval, redirected to `/api/auth/callback/google`
4. Session created, redirected to `/editor`
5. User menu appears in toolbar with profile info

## Troubleshooting

### "Sign in failed" error
- Check Google OAuth credentials in `.env`
- Verify authorized redirect URIs in Google Cloud Console
- Ensure `NEXTAUTH_SECRET` is set

### GrowthBook features not loading
- Check `NEXT_PUBLIC_GROWTHBOOK_CLIENT_KEY` is correct
- Verify features are published in GrowthBook dashboard
- Check browser console for API errors

### User preferences not persisting
- Clear browser localStorage and try again
- Check browser console for storage errors

## Security Notes

- Never commit `.env` file to version control
- Keep `.env.example` updated with required keys (without values)
- Rotate `NEXTAUTH_SECRET` regularly in production
- Use environment-specific OAuth credentials

## Next Steps

- [ ] Set up production Google OAuth credentials
- [ ] Configure production GrowthBook environment
- [ ] Add additional user preferences (font size, line height)
- [ ] Implement user-specific file storage
- [ ] Add profile settings page

