import { Button, Frog } from 'frog'
import { devtools } from 'frog/dev'
import { serveStatic } from 'frog/serve-static'
import { handle } from 'frog/vercel'

// Uncomment to use Edge Runtime.
// export const config = {
//   runtime: 'edge',
// }

export const app = new Frog({
  assetsPath: '/',
  basePath: '/api',
  // Supply a Hub to enable frame verification.
  // hub: neynar({ apiKey: 'NEYNAR_FROG_FM' })
  title: 'MLB Schedule',
})

const API_KEY = 'FBKXX1hlX9Uo4vJ1y7Lcv7A9ScCFJSTpZwpXZdbX'

interface Game {
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

app.frame('/', async (c) => {
  const games = await fetchMLBSchedule()

  return c.res({
    image: (
      <div
        style={{
          alignItems: 'center',
          background: 'url(https://bafybeibowmohuk5b6xmxyh6mikmk2zo7y56nz2yaowknf6lgaq5xkqqnpm.ipfs.w3s.link/Frame%2060%20(1).png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          justifyContent: 'flex-start',
          padding: '40px',
          width: '100%',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 48,
            fontWeight: 'bold',
            marginBottom: '20px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          MLB Daily Schedule
        </div>
        {games && games.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
              width: '100%',
            }}
          >
            {games.slice(0, 5).map((game: Game, index: number) => (
              <div
                key={index}
                style={{
                  background: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: 24,
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                {game.away.name} @ {game.home.name}
                <br />
                {new Date(game.scheduled).toLocaleTimeString()}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            color: 'white', 
            fontSize: 32,
            background: 'rgba(0, 0, 0, 0.7)',
            padding: '20px',
            borderRadius: '8px',
          }}>
            No games scheduled for today.
          </div>
        )}
      </div>
    ),
    intents: [
      <Button>Refresh Schedule</Button>,
    ],
  })
})

const isProduction = process.env.NODE_ENV === 'production'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)