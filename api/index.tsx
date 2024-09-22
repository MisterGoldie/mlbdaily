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
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'flex-start',
          width: '100%',
          height: '100%',
          padding: '40px',
          backgroundImage: 'url(https://bafybeibowmohuk5b6xmxyh6mikmk2zo7y56nz2yaowknf6lgaq5xkqqnpm.ipfs.w3s.link/Frame%2060%20(1).png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: '48px',
            fontWeight: 'bold',
            marginBottom: '20px',
            textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
          }}
        >
          MLB Daily Schedule
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            width: '100%',
          }}
        >
          {games && games.length > 0 ? (
            games.slice(0, 5).map((game: Game, index: number) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'rgba(0, 0, 0, 0.7)',
                  borderRadius: '8px',
                  color: 'white',
                  fontSize: '24px',
                  padding: '10px',
                  textAlign: 'center',
                }}
              >
                <span>{game.away.name} @ {game.home.name}</span>
                <span>{new Date(game.scheduled).toLocaleTimeString()}</span>
              </div>
            ))
          ) : (
            <div
              style={{ 
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                color: 'white', 
                fontSize: '32px',
                background: 'rgba(0, 0, 0, 0.7)',
                padding: '20px',
                borderRadius: '8px',
              }}
            >
              No games scheduled for today.
            </div>
          )}
        </div>
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