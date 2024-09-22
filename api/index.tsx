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
  status: string;
  scheduled: string;
  away: { name: string; id: string };
  home: { name: string; id: string };
  away_score?: number;
  home_score?: number;
  inning?: number;
  inning_half?: string;
  venue_id?: string;
}

interface Venue {
  id: string;
  name: string;
  city: string;
  state: string;
}

let venuesCache: Venue[] | null = null;

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

async function fetchVenues(): Promise<Venue[] | null> {
  if (venuesCache) return venuesCache;

  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/league/venues.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    venuesCache = data.venues
    return venuesCache
  } catch (error) {
    console.error('Error fetching venues:', error)
    return null
  }
}

function findVenue(venues: Venue[], venueId: string): Venue | undefined {
  return venues.find(venue => venue.id === venueId)
}

app.frame('/', async (c) => {
  console.log('Root frame called')
  try {
    const games = await fetchMLBSchedule()

    if (!games || games.length === 0) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=No+MLB+Games+Today',
        intents: [
          <Button>Refresh</Button>
        ]
      })
    }

    return c.res({
      image: `https://placehold.co/600x400/png?text=${encodeURIComponent(`MLB Schedule\n${games.length} Games Today`)}`,
      intents: [
        <Button action="/games/0">View Games</Button>,
      ],
    })
  } catch (error) {
    console.error('Error in root frame:', error)
    return c.res({
      image: 'https://placehold.co/600x400/png?text=Error+Occurred',
      intents: [
        <Button>Refresh</Button>
      ]
    })
  }
})

app.frame('/games/:index', async (c) => {
  console.log('Game frame called with index:', c.req.param('index'))
  try {
    const [games, venues] = await Promise.all([fetchMLBSchedule(), fetchVenues()])
    
    if (!games || games.length === 0) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=No+MLB+Games+Today',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    if (!venues) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=Error+Fetching+Venues',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      return c.res({
        image: 'https://placehold.co/600x400/png?text=Game+Not+Found',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const gameTime = new Date(game.scheduled).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
      timeZone: 'America/New_York'
    })

    let statusInfo = game.status === 'scheduled' ? `${gameTime} ET` : 
                     game.status === 'inprogress' ? `In Progress\nInning: ${game.inning_half || ''} ${game.inning || ''}\nScore: ${game.away_score || 0}-${game.home_score || 0}` :
                     `Final: ${game.away_score || 0}-${game.home_score || 0}`

    const venue = game.venue_id ? findVenue(venues, game.venue_id) : undefined
    let locationInfo = venue 
      ? `${venue.name}, ${venue.city}, ${venue.state}`
      : 'Location not available'

    const imageText = `${game.away.name} @ ${game.home.name}\n${statusInfo}\n${locationInfo}\nGame ${index + 1} of ${games.length}`

    return c.res({
      image: `https://placehold.co/600x400/png?text=${encodeURIComponent(imageText)}`,
      intents: [
        index > 0 && <Button action={`/games/${index - 1}`}>Previous</Button>,
        index < games.length - 1 && <Button action={`/games/${index + 1}`}>Next</Button>,
        <Button action="/">Back to Start</Button>,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('Error in game frame:', error)
    return c.res({
      image: 'https://placehold.co/600x400/png?text=Error+Occurred',
      intents: [
        <Button action="/">Back to Start</Button>
      ]
    })
  }
})

const isProduction = process.env.NODE_ENV === 'production'
devtools(app, isProduction ? { assetsPath: '/.frog' } : { serveStatic })

export const GET = handle(app)
export const POST = handle(app)