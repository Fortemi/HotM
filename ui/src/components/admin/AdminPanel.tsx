/**
 * AdminPanel Component
 * System administration interface for HotM
 *
 * Provides access to:
 * - System information and health metrics
 * - Embedding configuration management
 * - Authentication settings (placeholder)
 * - Application information
 */

import * as React from 'react';
import { Settings, Shield, Database, Cpu, Lock, Info } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { api } from '@/api';
import type { EmbeddingConfig, KnowledgeHealth } from '@/api';

export interface AdminPanelProps {
  className?: string;
}

interface SystemHealth {
  status: string;
  version: string;
  database: string;
  ollama?: string;
}

export function AdminPanel({ className }: AdminPanelProps) {
  const [activeTab, setActiveTab] = React.useState('system');
  const [systemHealth, setSystemHealth] = React.useState<SystemHealth | null>(null);
  const [knowledgeHealth, setKnowledgeHealth] = React.useState<KnowledgeHealth | null>(null);
  const [embeddingConfigs, setEmbeddingConfigs] = React.useState<EmbeddingConfig[]>([]);
  const [defaultConfig, setDefaultConfig] = React.useState<EmbeddingConfig | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  // Fetch system info
  React.useEffect(() => {
    if (activeTab === 'system') {
      fetchSystemInfo();
    }
  }, [activeTab]);

  // Fetch embedding configs
  React.useEffect(() => {
    if (activeTab === 'embedding') {
      fetchEmbeddingConfigs();
    }
  }, [activeTab]);

  const fetchSystemInfo = async () => {
    setLoading(true);
    setError(null);
    try {
      const [healthData, knowledgeData] = await Promise.all([
        api.healthCheck(),
        api.health.getKnowledgeHealth(),
      ]);
      setSystemHealth(healthData);
      setKnowledgeHealth(knowledgeData);
    } catch (err) {
      setError('Error loading system info');
      console.error('Failed to fetch system info:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEmbeddingConfigs = async () => {
    setLoading(true);
    setError(null);
    try {
      const [configs, defaultCfg] = await Promise.all([
        api.embeddings.listConfigs(),
        api.embeddings.getDefaultConfig(),
      ]);
      setEmbeddingConfigs(configs);
      setDefaultConfig(defaultCfg);
    } catch (err) {
      setError('Error loading embedding configs');
      console.error('Failed to fetch embedding configs:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex items-center gap-2">
        <Settings className="size-6" />
        <h1 className="text-2xl font-bold">Admin Panel</h1>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="system">
            <Database className="size-4" />
            System Info
          </TabsTrigger>
          <TabsTrigger value="embedding">
            <Cpu className="size-4" />
            Embedding Config
          </TabsTrigger>
          <TabsTrigger value="auth">
            <Shield className="size-4" />
            Authentication
          </TabsTrigger>
          <TabsTrigger value="about">
            <Info className="size-4" />
            About
          </TabsTrigger>
        </TabsList>

        {/* System Info Tab */}
        <TabsContent value="system">
          {loading && <div className="text-muted-foreground">Loading system information...</div>}
          {error && <div className="text-destructive">{error}</div>}
          {!loading && !error && (
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>System Health</CardTitle>
                  <CardDescription>API and service status</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Status</span>
                    <Badge variant={systemHealth?.status === 'healthy' ? 'default' : 'destructive'}>
                      {systemHealth?.status || 'unknown'}
                    </Badge>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">API Version</span>
                    <span className="text-sm text-muted-foreground">{systemHealth?.version || 'N/A'}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Database</span>
                    <span className="text-sm text-muted-foreground">{systemHealth?.database || 'N/A'}</span>
                  </div>
                  {systemHealth?.ollama && (
                    <>
                      <Separator />
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Ollama</span>
                        <span className="text-sm text-muted-foreground">{systemHealth.ollama}</span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Knowledge Base Health</CardTitle>
                  <CardDescription>Statistics about your knowledge base</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Total Notes</span>
                    <span className="text-sm text-muted-foreground">{knowledgeHealth?.total_notes || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Orphan Notes</span>
                    <span className="text-sm text-muted-foreground">{knowledgeHealth?.orphan_notes || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Stale Notes</span>
                    <span className="text-sm text-muted-foreground">{knowledgeHealth?.stale_notes || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Unlinked Notes</span>
                    <span className="text-sm text-muted-foreground">{knowledgeHealth?.unlinked_notes || 0}</span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Avg Links per Note</span>
                    <span className="text-sm text-muted-foreground">
                      {knowledgeHealth?.avg_links_per_note?.toFixed(1) || '0.0'}
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Tag Coverage</span>
                    <span className="text-sm text-muted-foreground">
                      {knowledgeHealth?.tag_coverage ? `${(knowledgeHealth.tag_coverage * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        {/* Embedding Config Tab */}
        <TabsContent value="embedding">
          {loading && <div className="text-muted-foreground">Loading embedding configurations...</div>}
          {error && <div className="text-destructive">{error}</div>}
          {!loading && !error && (
            <Card>
              <CardHeader>
                <CardTitle>Embedding Model Configuration</CardTitle>
                <CardDescription>Current embedding model settings</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {defaultConfig && (
                  <div className="flex flex-col gap-3 p-4 border rounded-lg bg-muted/50">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">Active Configuration</span>
                      <Badge>Default</Badge>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Name</span>
                      <span className="text-sm text-muted-foreground">{defaultConfig.name}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Model</span>
                      <span className="text-sm text-muted-foreground font-mono">{defaultConfig.model}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Dimensions</span>
                      <span className="text-sm text-muted-foreground">{defaultConfig.dimensions}</span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Created</span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(defaultConfig.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}

                {embeddingConfigs.length > 1 && (
                  <div className="flex flex-col gap-2">
                    <h3 className="text-sm font-semibold">Available Configurations</h3>
                    {embeddingConfigs.map((config) => (
                      <div key={config.id} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex flex-col gap-1">
                          <span className="text-sm font-medium">{config.name}</span>
                          <span className="text-xs text-muted-foreground font-mono">{config.model}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground">{config.dimensions}d</span>
                          {config.is_default && <Badge variant="outline">Default</Badge>}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Authentication Tab */}
        <TabsContent value="auth">
          <Card>
            <CardHeader>
              <CardTitle>Authentication</CardTitle>
              <CardDescription>OAuth2 login and API key management</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center gap-4 py-12">
              <Lock className="size-16 text-muted-foreground" />
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Authentication features including OAuth2 login, API key management, and user access controls
                  will be available in a future release.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about">
          <Card>
            <CardHeader>
              <CardTitle>About HotM</CardTitle>
              <CardDescription>Hall of the Mind - Note-taking with AI enhancement</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Version</span>
                  <span className="text-sm text-muted-foreground">0.1.2</span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">License</span>
                  <span className="text-sm text-muted-foreground">MIT</span>
                </div>
                <Separator />
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">Description</span>
                  <p className="text-sm text-muted-foreground">
                    HotM is a React-based single-page application providing a rich web interface for note-taking
                    and analysis. The application consumes the Fortemi API for immutable note storage,
                    NLP-powered revisions, and hybrid search capabilities.
                  </p>
                </div>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Key Features</h3>
                <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
                  <li>Immutable original content with AI-enhanced revisions</li>
                  <li>Hybrid search combining full-text and semantic search</li>
                  <li>Dynamic linking and knowledge graph visualization</li>
                  <li>Tag-based organization and filtering</li>
                  <li>Note versioning and provenance tracking</li>
                </ul>
              </div>

              <Separator />

              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold">Technology Stack</h3>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">React 19</Badge>
                  <Badge variant="outline">TypeScript</Badge>
                  <Badge variant="outline">Vite</Badge>
                  <Badge variant="outline">TailwindCSS</Badge>
                  <Badge variant="outline">Radix UI</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
