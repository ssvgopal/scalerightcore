import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Plus, Settings, Play, Trash2, Eye } from 'lucide-react';

interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  capabilities: string[];
  icon: string;
  tags: string[];
}

interface CustomAgent {
  id: string;
  name: string;
  description: string;
  templateId: string;
  configuration: Record<string, any>;
  capabilities: string[];
  status: string;
  createdAt: string;
}

interface AgentBuilderProps {
  organizationId: string;
  userId: string;
}

export default function AgentBuilder({ organizationId, userId }: AgentBuilderProps) {
  const [templates, setTemplates] = useState<AgentTemplate[]>([]);
  const [customAgents, setCustomAgents] = useState<CustomAgent[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<AgentTemplate | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTemplates();
    loadCustomAgents();
  }, []);

  const loadTemplates = async () => {
    try {
      const response = await fetch('/api/v2/agent-builder/templates');
      const data = await response.json();
      if (data.success) {
        setTemplates(data.data);
      }
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  };

  const loadCustomAgents = async () => {
    try {
      const response = await fetch('/api/v2/agent-builder/agents');
      const data = await response.json();
      if (data.success) {
        setCustomAgents(data.data);
      }
    } catch (error) {
      console.error('Failed to load custom agents:', error);
    } finally {
      setLoading(false);
    }
  };

  const createAgent = async (agentData: any) => {
    setIsCreating(true);
    try {
      const response = await fetch('/api/v2/agent-builder/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agentData),
      });

      const data = await response.json();
      if (data.success) {
        setCustomAgents(prev => [...prev, data.data]);
        setSelectedTemplate(null);
      }
    } catch (error) {
      console.error('Failed to create agent:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const deployAgent = async (agentId: string) => {
    try {
      const response = await fetch(`/api/v2/agent-builder/agents/${agentId}/deploy`, {
        method: 'POST',
      });

      const data = await response.json();
      if (data.success) {
        // Update agent status
        setCustomAgents(prev =>
          prev.map(agent =>
            agent.id === agentId
              ? { ...agent, status: 'active' }
              : agent
          )
        );
      }
    } catch (error) {
      console.error('Failed to deploy agent:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Agent Builder</h1>
          <p className="text-muted-foreground">Create custom AI agents without coding</p>
        </div>
        <Button onClick={() => setSelectedTemplate(templates[0])}>
          <Plus className="h-4 w-4 mr-2" />
          Create New Agent
        </Button>
      </div>

      <Tabs defaultValue="templates" className="space-y-6">
        <TabsList>
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="my-agents">My Agents</TabsTrigger>
        </TabsList>

        <TabsContent value="templates" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {templates.map((template) => (
              <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                      {template.icon === 'support' && '🛠️'}
                      {template.icon === 'analytics' && '📊'}
                      {template.icon === 'document' && '📄'}
                      {template.icon === 'crm' && '👥'}
                      {template.icon === 'workflow' && '⚡'}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {template.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      <strong>Capabilities:</strong> {template.capabilities.join(', ')}
                    </div>
                    <Button
                      className="w-full"
                      onClick={() => setSelectedTemplate(template)}
                    >
                      Use Template
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="my-agents" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {customAgents.map((agent) => (
              <Card key={agent.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <Badge variant={agent.status === 'active' ? 'default' : 'secondary'}>
                      {agent.status}
                    </Badge>
                  </div>
                  <CardDescription>{agent.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex flex-wrap gap-1">
                      {agent.capabilities.map((capability) => (
                        <Badge key={capability} variant="outline" className="text-xs">
                          {capability}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                      {agent.status !== 'active' && (
                        <Button size="sm" onClick={() => deployAgent(agent.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Deploy
                        </Button>
                      )}
                      <Button variant="outline" size="sm">
                        <Eye className="h-4 w-4 mr-2" />
                        Test
                      </Button>
                      <Button variant="outline" size="sm">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      {selectedTemplate && (
        <AgentCreationModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onCreate={createAgent}
          organizationId={organizationId}
        />
      )}
    </div>
  );
}

interface AgentCreationModalProps {
  template: AgentTemplate;
  onClose: () => void;
  onCreate: (agentData: any) => Promise<void>;
  organizationId: string;
}

function AgentCreationModal({ template, onClose, onCreate, organizationId }: AgentCreationModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    configuration: template.defaultConfig,
  });
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      await onCreate({
        ...formData,
        templateId: template.id,
      });
    } finally {
      setIsCreating(false);
    }
  };

  const updateConfig = (key: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      configuration: {
        ...prev.configuration,
        [key]: value,
      },
    }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <CardTitle>Create Agent from Template</CardTitle>
          <CardDescription>{template.description}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Agent Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter agent name"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe what this agent will do"
                rows={3}
                required
              />
            </div>

            <div className="space-y-4">
              <Label>Configuration</Label>
              {Object.entries(template.configSchema.properties || {}).map(([key, field]: [string, any]) => (
                <div key={key} className="space-y-2">
                  <Label className="text-sm font-medium">
                    {field.description || key}
                    {field.required && <span className="text-red-500 ml-1">*</span>}
                  </Label>

                  {field.type === 'string' && field.enum ? (
                    <Select
                      value={formData.configuration[key] || field.default}
                      onValueChange={(value) => updateConfig(key, value)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={`Select ${key}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.enum.map((option: string) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : field.type === 'boolean' ? (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id={key}
                        checked={formData.configuration[key] || field.default || false}
                        onChange={(e) => updateConfig(key, e.target.checked)}
                        className="rounded"
                      />
                      <Label htmlFor={key} className="text-sm">
                        {field.description || key}
                      </Label>
                    </div>
                  ) : field.type === 'number' ? (
                    <Input
                      type="number"
                      value={formData.configuration[key] || field.default || 0}
                      onChange={(e) => updateConfig(key, Number(e.target.value))}
                      min={field.minimum}
                      max={field.maximum}
                    />
                  ) : field.type === 'array' ? (
                    <Input
                      value={Array.isArray(formData.configuration[key])
                        ? formData.configuration[key].join(', ')
                        : (formData.configuration[key] || field.default || '').toString()}
                      onChange={(e) => updateConfig(key, e.target.value.split(',').map(s => s.trim()))}
                      placeholder="Enter values separated by commas"
                    />
                  ) : (
                    <Input
                      value={formData.configuration[key] || field.default || ''}
                      onChange={(e) => updateConfig(key, e.target.value)}
                      placeholder={`Enter ${key}`}
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Agent
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
