"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { templatesApi } from "@/lib/api/projects";
import { getDraftUpdatesFromTemplate } from "@/lib/template-includes";
import { useProjectStore } from "@/lib/stores/project-store";
import { useAuthStore } from "@/lib/stores/auth-store";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import type { VideoTemplate, ProjectType } from "@/types";

interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectType: ProjectType;
  onTemplateSelected: (template: VideoTemplate) => void;
}

export function TemplateSelector({
  open,
  onOpenChange,
  projectType,
  onTemplateSelected,
}: TemplateSelectorProps) {
  const [templates, setTemplates] = useState<VideoTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const { user } = useAuthStore();
  const { updateDraft } = useProjectStore();

  useEffect(() => {
    if (open && user?.id) {
      loadTemplates();
    }
  }, [open, user?.id, projectType]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      // Load all templates (don't filter by projectType) so user can see both story and two-char templates
      const result = await templatesApi.list();
      setTemplates(result.templates);
    } catch (error) {
      console.error("Failed to load templates:", error);
      toast.error("Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, templateId: string, templateName: string) => {
    e.stopPropagation(); // Prevent card click
    
    if (!confirm(`Are you sure you want to delete "${templateName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      await templatesApi.delete(templateId);
      toast.success("Template deleted successfully");
      // Reload templates
      loadTemplates();
    } catch (error) {
      console.error("Failed to delete template:", error);
      toast.error("Failed to delete template");
    }
  };

  const handleSelectTemplate = (template: VideoTemplate) => {
    // Normalize project type: "story" or "NORMAL_STORY" should both be "story"
    const normalizedType =
      template.projectType === "story" || template.projectType === "NORMAL_STORY"
        ? "story"
        : template.projectType;

    const updates = getDraftUpdatesFromTemplate(template, normalizedType);
    updateDraft(updates);

    onTemplateSelected(template);
    onOpenChange(false);
    toast.success(`Template "${template.name}" loaded!`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select a Template</DialogTitle>
          <DialogDescription>
            Choose a template to load its background, subtitle style, and text overlay settings.
          </DialogDescription>
        </DialogHeader>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : templates.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No templates found for this project type.</p>
            <p className="text-sm mt-2">Create a template from the preview page after customizing your video.</p>
          </div>
        ) : (
          <div className="grid gap-4 py-4">
            {templates.map((template) => (
              <Card
                key={template.id}
                className="cursor-pointer hover:bg-muted/50 transition-colors relative"
                onClick={() => handleSelectTemplate(template)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      {template.description && (
                        <CardDescription className="mt-1">
                          {template.description}
                        </CardDescription>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{template.backgroundId}</Badge>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={(e) => handleDeleteTemplate(e, template.id, template.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
                    <span>Style: {template.subtitleStyle}</span>
                    {template.textOverlays.length > 0 && (
                      <span>• {template.textOverlays.length} text overlay{template.textOverlays.length !== 1 ? 's' : ''}</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

