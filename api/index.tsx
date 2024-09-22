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
  home: {
    name: string;
    market: string;
    abbr: string;
    id: string;
    runs: number;
    hits: number;
    errors: number;
  };
  away: {
    name: string;
    market: string;
    abbr: string;
    id: string;
    runs: number;
    hits: number;
    errors: number;
  };
}

async function fetchMLBSchedule(): Promise<Game[] | null> {
  const date = new Date().toISOString().split('T')[0].replace(/-/g, '/')
  const apiUrl = `https://api.sportradar.com/mlb/trial/v7/en/games/${date}/boxscore.json?api_key=${API_KEY}`

  try {
    const response = await fetch(apiUrl)
    const data = await response.json()
    console.log('Full API response:', JSON.stringify(data, null, 2))
    
    if (data.league && Array.isArray(data.league.games)) {
      return data.league.games.map((item: { game: Game }) => item.game);
    } else {
      console.error('Unexpected API response structure:', data)
      return null
    }
  } catch (error) {
    console.error('Error fetching boxscore:', error)
    return null
  }
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
    const games = await fetchMLBSchedule()
    
    if (!games || games.length === 0) {
      return c.res({
        image: 'https://placehold.co/1200x630/png?text=No+Data+Available&font-size=32',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      return c.res({
        image: 'https://placehold.co/1200x630/png?text=Game+Not+Found&font-size=32',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    console.log('Full game data:', JSON.stringify(game, null, 2))

    const awayTeam = `${game.away.market} ${game.away.name}`
    const homeTeam = `${game.home.market} ${game.home.name}`
    const awayScore = game.away.runs
    const homeScore = game.home.runs

    let statusInfo = ''
    if (game.status === 'closed' || game.status === 'complete') {
      statusInfo = `Final: ${awayScore}-${homeScore}`
    } else if (game.status === 'inprogress' || game.status === 'live') {
      statusInfo = `In Progress: ${awayScore}-${homeScore}`
    } else {
      const gameTime = new Date(game.scheduled).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
        timeZone: 'America/New_York'
      })
      statusInfo = `Scheduled: ${gameTime} ET`
    }

    const gameNumberInfo = `Game ${index + 1} of ${games.length}`

    // Use '|' as a delimiter for line breaks
    const imageText = `${awayTeam}|@|${homeTeam}|${statusInfo}|${gameNumberInfo}`

    console.log('Image text:', imageText)

    return c.res({
      // Increase image size, reduce font size, use word-wrap and line-height
      image: `https://placehold.co/1200x630/png?text=${encodeURIComponent(imageText)}&font-size=30&word-wrap=true&line-height=1.5`,
      intents: [
        <Button action={`/comparison/${index}`}>Team Comparison</Button>,
        index > 0 && <Button action={`/games/${index - 1}`}>Previous</Button>,
        index < games.length - 1 && <Button action={`/games/${index + 1}`}>Next</Button>,
        <Button action="/">Back to Start</Button>,
      ].filter(Boolean),
    })
  } catch (error) {
    console.error('Error in game frame:', error)
    return c.res({
      image: 'https://placehold.co/1200x630/png?text=Error+Occurred&font-size=32',
      intents: [
        <Button action="/">Back to Start</Button>
      ]
    })
  }
})

app.frame('/comparison/:index', async (c) => {
  console.log('Comparison frame called with index:', c.req.param('index'))
  try {
    const games = await fetchMLBSchedule()
    
    if (!games || games.length === 0) {
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=No+Data+Available&font-size=24',
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=Game+Not+Found&font-size=24',
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const awayTeam = `${game.away.market} ${game.away.name}`
    const homeTeam = `${game.home.market} ${game.home.name}`

    const comparisonText = `
${awayTeam} vs ${homeTeam}

Runs:
${awayTeam}: ${game.away.runs}
${homeTeam}: ${game.home.runs}

Hits:
${awayTeam}: ${game.away.hits}
${homeTeam}: ${game.home.hits}

Errors:
${awayTeam}: ${game.away.errors}
${homeTeam}: ${game.home.errors}
    `.trim()

    const imageUrl = `https://placehold.co/1000x1000/png?text=${encodeURIComponent(comparisonText)}&font-size=24`

    return c.res({
      image: imageUrl,
      imageAspectRatio: '1:1',
      intents: [
        <Button action={`/comparison2/${index}`}>More Stats</Button>,
        <Button action={`/games/${index}`}>Back to Game</Button>,
        <Button action="/">Back to Start</Button>
      ],
    })
  } catch (error) {
    console.error('Error in comparison frame:', error)
    return c.res({
      image: 'https://placehold.co/1000x1000/png?text=Error+Occurred&font-size=24',
      imageAspectRatio: '1:1',
      intents: [
        <Button action="/">Back to Start</Button>
      ]
    })
  }
})

app.frame('/comparison2/:index', async (c) => {
  console.log('Comparison2 frame called with index:', c.req.param('index'))
  try {
    const games = await fetchMLBSchedule()
    
    if (!games || games.length === 0) {
      console.log('No games data available')
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=No+Games+Data+Available&font-size=24',
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    const index = parseInt(c.req.param('index'))
    const game = games[index]

    if (!game) {
      console.log('Game not found for index:', index)
      return c.res({
        image: 'https://placehold.co/1000x1000/png?text=Game+Not+Found&font-size=24',
        imageAspectRatio: '1:1',
        intents: [
          <Button action="/">Back to Start</Button>
        ]
      })
    }

    console.log('Game data:', JSON.stringify(game, null, 2))

    const awayTeam = `${game.away.market} ${game.away.name}`
    const homeTeam = `${game.home.market} ${game.home.name}`

    const comparisonText = `
${awayTeam} vs ${homeTeam}

Game Status: ${game.status}

Scheduled Time: ${new Date(game.scheduled).toLocaleString()}

Team Abbreviations:
${awayTeam}: ${game.away.abbr}
${homeTeam}: ${game.home.abbr}
    `.trim()

    console.log('Comparison text:', comparisonText)

    const imageUrl = `https://placehold.co/1000x1000/png?text=${encodeURIComponent(comparisonText)}&font-size=24`

    return c.res({
      image: imageUrl,
      imageAspectRatio: '1:1',
      intents: [
        <Button action={`/comparison/${index}`}>Previous Stats</Button>,
        <Button action={`/games/${index}`}>Back to Game</Button>,
        <Button action="/">Back to Start</Button>
      ],
    })
  } catch (error) {
    console.error('Error in comparison2 frame:', error)
    return c.res({
      image: 'https://placehold.co/1000x1000/png?text=Error+Occurred&font-size=24',
      imageAspectRatio: '1:1',
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