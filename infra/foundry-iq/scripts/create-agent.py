import argparse
import json
import os
from pathlib import Path

from azure.ai.projects import AIProjectClient
from azure.ai.projects.models import MCPTool, PromptAgentDefinition
from azure.identity import AzureCliCredential


DEFAULT_INSTRUCTIONS = (
    'You are Hyroglyphis IQ. Use the attached '
    'Hyroglyphis knowledge base whenever style, '
    'lore, continuity, remix context, stillframe '
    'ritual language, ARV motion rules, or '
    'reusable prompt fragments are relevant. '
    'Stay grounded in retrieved project '
    'documents. Prefer concise, production-ready '
    'guidance and do not invent '
    'canon that is not supported by the retrieved material.'
)


def load_instructions(path: str | None) -> str:
    if not path:
        return DEFAULT_INSTRUCTIONS
    return Path(path).read_text(encoding='utf-8').strip()


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            'Create or update the Hyroglyphis '
            'Foundry IQ prompt agent.'
        )
    )
    parser.add_argument(
        '--project-endpoint',
        default=os.environ.get('AZURE_AI_FOUNDRY_ENDPOINT'),
    )
    parser.add_argument('--agent-name', default='hyroglyphis-iq-agent')
    parser.add_argument('--connection-name', default='hyroglyphis-iq-kb-mcp')
    parser.add_argument(
        '--search-endpoint',
        default='https://hyroglyphisiq2026.search.windows.net',
    )
    parser.add_argument('--knowledge-base-name', default='hyroglyphis-iq-kb')
    parser.add_argument('--model', default='gpt-4.1')
    parser.add_argument('--server-label', default='hyroglyphis_iq')
    parser.add_argument(
        '--description',
        default=(
            'Hyroglyphis IQ agent backed by Azure '
            'AI Search knowledge base MCP retrieval.'
        ),
    )
    parser.add_argument('--instructions-file')
    parser.add_argument('--metadata-source', default='copilot-export')
    args = parser.parse_args()

    if not args.project_endpoint:
        raise SystemExit(
            'Missing --project-endpoint and '
            'AZURE_AI_FOUNDRY_ENDPOINT is not set.'
        )

    instructions = load_instructions(args.instructions_file)
    search_endpoint = args.search_endpoint.rstrip('/')
    server_url = (
        f'{search_endpoint}/knowledgebases/'
        f'{args.knowledge_base_name}/mcp'
        '?api-version=2026-05-01-preview'
    )

    project = AIProjectClient(
        endpoint=args.project_endpoint,
        credential=AzureCliCredential(),
        allow_preview=True,
    )

    tool = MCPTool(
        server_label=args.server_label,
        server_url=server_url,
        project_connection_id=args.connection_name,
        require_approval='never',
    )

    agent = project.agents.create_version(
        agent_name=args.agent_name,
        definition=PromptAgentDefinition(
            model=args.model,
            instructions=instructions,
            tools=[tool],
        ),
        description=args.description,
        metadata={
            'source': args.metadata_source,
            'knowledge_base': args.knowledge_base_name,
        },
    )

    print(
        json.dumps(
            {
                'agent_name': agent.name,
                'agent_version': agent.version,
                'agent_id': agent.id,
                'project_endpoint': args.project_endpoint,
                'connection_name': args.connection_name,
                'server_url': server_url,
            },
            ensure_ascii=False,
        )
    )


if __name__ == '__main__':
    main()
