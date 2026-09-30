import { Router, Request, Response } from 'express';
import { analyzeCivicIssue, generateTrendSummary, generateCivicPlaybook } from './geminiHelper.ts';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    service: 'CivicLens AI API',
    timestamp: new Date().toISOString(),
  });
});

/**
 * POST /api/analyze-issue
 * Validates citizen issue inputs and produces structured AI intelligence
 */
apiRouter.post('/analyze-issue', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Invalid request payload: Expected JSON object.' });
      return;
    }

    const { description, location, citizenCategory } = req.body;

    // Validate description
    if (typeof description !== 'string') {
      res.status(400).json({ error: 'Description is required and must be text.' });
      return;
    }

    const trimmedDesc = description.trim();
    if (trimmedDesc.length < 10) {
      res.status(400).json({ error: 'Please provide at least 10 characters describing the issue.' });
      return;
    }

    if (trimmedDesc.length > 8000) {
      res.status(400).json({ error: 'Description exceeds maximum allowed limit of 8,000 characters.' });
      return;
    }

    // Validate location
    if (typeof location !== 'string') {
      res.status(400).json({ error: 'Location is required and must be text.' });
      return;
    }

    const trimmedLoc = location.trim();
    if (trimmedLoc.length < 2) {
      res.status(400).json({ error: 'Please specify a valid street, landmark, or neighborhood location.' });
      return;
    }

    if (trimmedLoc.length > 300) {
      res.status(400).json({ error: 'Location exceeds maximum allowed limit of 300 characters.' });
      return;
    }

    // Optional category check
    let sanitizedCategory: string | undefined = undefined;
    if (citizenCategory && typeof citizenCategory === 'string') {
      sanitizedCategory = citizenCategory.trim().slice(0, 50);
    }

    const analysis = await analyzeCivicIssue(trimmedDesc, trimmedLoc, sanitizedCategory);

    res.json({
      success: true,
      analysis,
      disclaimer: 'AI-generated analysis — requires human verification.',
      analyzedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error analyzing civic issue:', error);
    const message = error instanceof Error ? error.message : 'Unknown AI processing error';
    res.status(500).json({
      error: 'CivicLens intelligence engine encountered an issue analyzing this report.',
      details: message.includes('API_KEY') ? 'Configuration issue' : message,
    });
  }
});

/**
 * POST /api/trend-summary
 * Generates an executive trend report from aggregated historical metrics
 */
apiRouter.post('/trend-summary', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Invalid request: aggregate data payload required.' });
      return;
    }

    const { dateRange, totalCount, categoryCounts, severityCounts, statusCounts, averagePriority, topLocations } = req.body;

    if (!dateRange || typeof dateRange.from !== 'string' || typeof dateRange.to !== 'string') {
      res.status(400).json({ error: 'Invalid date range provided.' });
      return;
    }

    const safeTotal = typeof totalCount === 'number' ? totalCount : 0;
    if (safeTotal === 0) {
      res.json({
        success: true,
        summary: {
          headline: 'No issues recorded in selected time window',
          summary: 'There are no citizen reports registered during the selected date range.',
          keyPatterns: ['Zero incidents logged in this period'],
          vulnerableAreas: ['None identified'],
          strategicRecommendations: ['Continue ongoing monitoring and community reporting channels.']
        },
        disclaimer: 'AI-generated trend summary.'
      });
      return;
    }

    const result = await generateTrendSummary({
      dateRange: { from: dateRange.from.slice(0, 30), to: dateRange.to.slice(0, 30) },
      totalCount: safeTotal,
      categoryCounts: (categoryCounts && typeof categoryCounts === 'object') ? categoryCounts : {},
      severityCounts: (severityCounts && typeof severityCounts === 'object') ? severityCounts : {},
      statusCounts: {
        open: Number(statusCounts?.open || 0),
        inProgress: Number(statusCounts?.inProgress || 0),
        resolved: Number(statusCounts?.resolved || 0),
      },
      averagePriority: typeof averagePriority === 'number' ? Math.round(averagePriority) : 50,
      topLocations: Array.isArray(topLocations) ? topLocations.slice(0, 5).map(String) : [],
    });

    res.json({
      success: true,
      summary: result,
      disclaimer: 'AI-generated trend summary — advisory for municipal planning.',
    });
  } catch (error: any) {
    console.error('Error generating trend summary:', error);
    res.status(500).json({
      error: 'Failed to generate trend summary from aggregate records.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/generate-playbook
 * Original Feature: Generates a Civic Resolution Playbook & Citizen Transparency Notice
 */
apiRouter.post('/generate-playbook', async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({ error: 'Missing issue payload.' });
      return;
    }

    const { title, category, severity, urgency, location, summary } = req.body;

    if (!title || !category || !location) {
      res.status(400).json({ error: 'title, category, and location are required.' });
      return;
    }

    const playbook = await generateCivicPlaybook({
      title: String(title).slice(0, 200),
      category: String(category).slice(0, 50),
      severity: String(severity || 'Medium').slice(0, 20),
      urgency: String(urgency || 'Medium').slice(0, 20),
      location: String(location).slice(0, 300),
      summary: String(summary || title).slice(0, 1000),
    });

    res.json({
      success: true,
      playbook,
      generatedAt: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Error generating civic playbook:', error);
    res.status(500).json({
      error: 'Failed to generate civic response playbook.',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});
