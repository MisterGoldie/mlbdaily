import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { handle } from 'frog/vercel'

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  title: 'MLB Schedule',
})

const API_KEY = 'FBKXX1hlX9Uo4vJ1y7Lcv7A9ScCFJSTpZwpXZdbX'

interface Game {
  id: string;
  away: { name: string };
  home: { name: string };
  scheduled: string;
}

async function fetchMLBSchedule(): Promise<Game[] | null> {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/games/${date}/schedule.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    return data.games
  } catch (error) {
    console.error('Error fetching schedule:', error)
    return null
  }
}

const backgroundStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  width: '100%',
  height: '100%',
  backgroundImage: 'url(https://bafybeibowmohuk5b6xmxyh6mikmk2zo7y56nz2yaowknf6lgaq5xkqqnpm.ipfs.w3s.link/Frame%2060%20(1).png)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  color: 'white',
  fontFamily: 'Arial, sans-serif',
}

const contentStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  backgroundColor: 'rgba(0,0,0,0.6)',
  padding: '20px',
  borderRadius: '10px',
}

app.frame('/', async (c) => {
  const games = await fetchMLBSchedule()

  if (!games || games.length === 0) {
    return c.res({
      image: (
        <div style={backgroundStyle}>
          <div style={contentStyle}>
            <div style={{ fontSize: '32px', textAlign: 'center' }}>No MLB games scheduled for today.</div>
          </div>
        </div>
      ),
      intents: [
        <Button>Refresh</Button>
      ]
    })
  }

  return c.res({
    image: (
      <div style={backgroundStyle}>
        <div style={contentStyle}>
          <div style={{ fontSize: '36px', fontWeight: 'bold', marginBottom: '20px', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>Today's MLB Games</div>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>{games.length} game{games.length !== 1 ? 's' : ''} scheduled</div>
          <div style={{ fontSize: '20px' }}>Tap 'View Games' to see details</div>
        </div>
      </div>
    ),
    intents: [
      <Button action="/games/0">View Games</Button>,
    ],
  })
})

app.frame('/games/:index', async (c) => {
  const games = await fetchMLBSchedule()
  if (!games || games.length === 0) {
    return c.res({
      image: (
        <div style={backgroundStyle}>
          <div style={contentStyle}>
            <div style={{ fontSize: '32px', textAlign: 'center' }}>No MLB games scheduled for today.</div>
          </div>
        </div>
      ),
      intents: [
        <Button action="/">Back to Start</Button>
      ]
    })
  }

  const index = parseInt(c.req.param('index'))
  const game = games[index]

  return c.res({
    image: (
      <div style={backgroundStyle}>
        <div style={contentStyle}>
          <div style={{ fontSize: '28px', fontWeight: 'bold', marginBottom: '20px', textAlign: 'center', textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>{game.away.name} @ {game.home.name}</div>
          <div style={{ fontSize: '24px', marginBottom: '10px' }}>{new Date(game.scheduled).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
          <div style={{ fontSize: '20px' }}>Game {index + 1} of {games.length}</div>
        </div>
      </div>
    ),
    intents: [
      index > 0 && <Button action={`/games/${index - 1}`}>Previous</Button>,
      index < games.length - 1 && <Button action={`/games/${index + 1}`}>Next</Button>,
      <Button action="/">Back to Start</Button>,
    ].filter(Boolean),
  })
})

const isProduction = process.env.NODE_ENV === 'production'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)