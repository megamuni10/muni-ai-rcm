# Getting Started - Muni AI RCM Platform

This guide will help you set up and run the Muni AI RCM Platform locally for development.

## Prerequisites

### Required Software

- **Node.js** 18.x or higher
- **Python** 3.11 or higher
- **AWS CLI** configured with appropriate credentials
- **Docker** (optional, for local database testing)
- **Git** for version control

### AWS Account Setup

1. AWS account with appropriate permissions
2. AWS CLI configured: `aws configure`
3. Amplify CLI: `npm install -g @aws-amplify/cli`
4. CDK CLI: `npm install -g aws-cdk`

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/muni-ai-rcm.git
cd muni-ai-rcm
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install app dependencies
cd app
npm install

# Install CDK dependencies
cd ../infra
npm install

# Return to root
cd ..
```

### 3. Configure Environment

Create a `.env.local` file in the `app` directory:

```env
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCOUNT_ID=your-account-id

# Development Mode
NEXT_PUBLIC_DEV_MODE=true

# Agent Configuration
AGENT_DEVELOPMENT_MODE=true

# Optional: Local database
DATABASE_URL=postgresql://localhost:5432/muni_rcm_dev
```

### 4. Set Up Amplify Backend

```bash
cd app
npx ampx sandbox
```

This will:
- Deploy authentication with Cognito
- Set up data models in DynamoDB
- Configure API endpoints
- Generate `amplify_outputs.json`

### 5. Run the Development Server

```bash
# From the app directory
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to see the application.

## Development Workflow

### Testing Different User Roles

The platform has three user roles with different dashboards:

1. **Admin** - System management and analytics
2. **Ops** - Claims processing and review
3. **Provider** - Claim submission and tracking

To test different roles in development:

1. Edit `app/lib/auth-utils.ts`
2. Change the return value in `getUserRole()`:
   ```typescript
   export function getUserRole(): UserRole {
     // For development, manually set role
     return 'admin'; // Change to 'ops' or 'provider'
   }
   ```

### Working with Agents

#### Test an Agent Locally

```bash
# From the root directory
./scripts/run-local-agent.sh CodingAgent

# With custom test payload
./scripts/run-local-agent.sh CodingAgent ./test-payloads/custom.json
```

#### Create a New Agent

1. Create agent directory:
   ```bash
   mkdir agents/MyNewAgent
   cd agents/MyNewAgent
   ```

2. Create `handler.py`:
   ```python
   import json
   import os

   def lambda_handler(event, context):
       # Development mode returns mock data
       if os.environ.get('DEVELOPMENT_MODE') == 'true':
           return {
               'statusCode': 200,
               'body': json.dumps({
                   'result': 'Mock response',
                   'confidence': 0.95
               })
           }
       
       # Production logic here
       return {
           'statusCode': 200,
           'body': json.dumps({'result': 'Production response'})
       }
   ```

3. Create JSON schema in `schemas/my-new-agent.json`

4. Add to CDK stack in `infra/lib/agents-stack.ts`

5. Create Server Action in `app/lib/actions.ts`

### Frontend Development

#### Key Directories

- `app/app/` - Pages and layouts
- `app/lib/` - Server actions and utilities
- `app/components/` - Reusable UI components

#### Common Tasks

**Add a new page:**
```bash
# Create new route
mkdir app/app/claims
touch app/app/claims/page.tsx
```

**Create a Server Action:**
```typescript
// app/lib/actions.ts
'use server';

export async function myAction(data: FormData) {
  // Server-side logic
  const result = await callAgent('MyAgent', data);
  return result;
}
```

**Use in a component:**
```tsx
// app/app/claims/page.tsx
import { myAction } from '@/lib/actions';

export default function ClaimsPage() {
  return (
    <form action={myAction}>
      <button type="submit">Submit</button>
    </form>
  );
}
```

## Local Database Setup (Optional)

For local database testing:

```bash
# Run PostgreSQL with Docker
docker run -d \
  --name muni-rcm-db \
  -e POSTGRES_PASSWORD=localpass \
  -e POSTGRES_DB=muni_rcm_dev \
  -p 5432:5432 \
  postgres:15-alpine

# Run migrations (when available)
npm run db:migrate
```

## Common Development Commands

```bash
# Frontend
npm run dev          # Start development server
npm run build        # Build for production
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks

# Testing agents
./scripts/test-agent.py --agent CodingAgent --payload test.json

# CDK
cd infra
cdk synth           # Synthesize CloudFormation
cdk diff            # Show deployment changes
cdk deploy          # Deploy to AWS
```

## Mock Data and Development Mode

The platform includes comprehensive mock data for development:

- **Agents** return realistic responses in development mode
- **Authentication** can be bypassed for local testing
- **External APIs** are mocked to avoid costs

To toggle development mode:
- Set `NEXT_PUBLIC_DEV_MODE=true` in `.env.local`
- Set `AGENT_DEVELOPMENT_MODE=true` for Lambda mocks

## Troubleshooting

### Common Issues

**Amplify sandbox fails:**
- Ensure AWS credentials are configured
- Check AWS region matches your config
- Try `npx ampx sandbox delete` and restart

**Agent tests fail:**
- Verify Python dependencies installed
- Check JSON schema matches test payload
- Ensure development mode is enabled

**Frontend build errors:**
- Clear `.next` cache: `rm -rf .next`
- Delete `node_modules` and reinstall
- Check TypeScript errors: `npm run type-check`

### Debug Mode

Enable detailed logging:

```typescript
// app/lib/utils/logger.ts
export const logger = {
  debug: process.env.NODE_ENV === 'development' ? console.log : () => {},
  error: console.error,
};
```

## Next Steps

1. Read [USER_ROLES_GUIDE.md](./USER_ROLES_GUIDE.md) to understand role-based features
2. Review [AGENT_DEVELOPMENT.md](./AGENT_DEVELOPMENT.md) for agent creation
3. Check [API_REFERENCE.md](./API_REFERENCE.md) for available endpoints
4. See [WORKFLOW_SYSTEM.md](./WORKFLOW_SYSTEM.md) for workflow implementation

## Getting Help

- Check existing documentation in `/docs`
- Review code examples in the repository
- Look for `TODO` comments for planned features
- Check agent test payloads in `/scripts/test-payloads`

## Development Best Practices

1. **Always use TypeScript** for type safety
2. **Follow the existing patterns** in the codebase
3. **Write tests** for new functionality
4. **Use development mode** to avoid external API calls
5. **Commit often** with clear messages
6. **Document your changes** in relevant docs

## Ready to Start Building?

You're now ready to start developing! The platform provides:
- Role-based dashboards
- AI-powered agent system
- Comprehensive mock data
- Type-safe development
- HIPAA-compliant architecture

Happy coding! 🚀