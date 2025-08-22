import { useState, useEffect } from 'react';
import { Check, ChevronsUpDown, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { api } from '@/services/api';

interface LabelAutocompleteProps {
  onAddLabel: (label: string) => void;
  onClose?: () => void;
  placeholder?: string;
  existingLabels?: string[];
}

export function LabelAutocomplete({ 
  onAddLabel, 
  onClose,
  placeholder = "Add label...",
  existingLabels = []
}: LabelAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [allLabels, setAllLabels] = useState<string[]>([]);
  const [inputValue, setInputValue] = useState("");

  useEffect(() => {
    loadLabels();
  }, []);

  const loadLabels = async () => {
    try {
      const labels = await api.getAllLabels();
      setAllLabels(labels);
    } catch (error) {
      console.error('Failed to load labels:', error);
    }
  };

  const handleSelect = (label: string) => {
    if (label && !existingLabels.includes(label)) {
      onAddLabel(label);
      setValue("");
      setInputValue("");
      setOpen(false);
      // Reload labels in case a new one was added
      loadLabels();
    }
  };

  const handleCreateNew = () => {
    if (inputValue.trim() && !existingLabels.includes(inputValue.trim())) {
      onAddLabel(inputValue.trim());
      setValue("");
      setInputValue("");
      setOpen(false);
      // Reload labels to include the new one
      loadLabels();
    }
  };

  // Filter out labels that are already applied to this note
  const availableLabels = allLabels.filter(label => !existingLabels.includes(label));
  
  // Filter based on input
  const filteredLabels = inputValue
    ? availableLabels.filter(label => 
        label.toLowerCase().includes(inputValue.toLowerCase())
      )
    : availableLabels;

  // Check if input exactly matches an existing label
  const exactMatch = allLabels.some(label => 
    label.toLowerCase() === inputValue.toLowerCase()
  );

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between"
          >
            {placeholder}
            <ChevronsUpDown className="ml-2 h-3 w-3 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0">
        <Command>
          <CommandInput 
            placeholder="Search labels..." 
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandEmpty>
            {inputValue && !exactMatch && (
              <div className="p-2">
                <Button
                  variant="ghost"
                  className="w-full justify-start"
                  onClick={handleCreateNew}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create "{inputValue}"
                </Button>
              </div>
            )}
            {!inputValue && "No labels found."}
          </CommandEmpty>
          <CommandGroup>
            {filteredLabels.map((label) => (
              <CommandItem
                key={label}
                value={label}
                onSelect={() => handleSelect(label)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    existingLabels.includes(label) ? "opacity-100" : "opacity-0"
                  )}
                />
                {label}
              </CommandItem>
            ))}
            {inputValue && !exactMatch && filteredLabels.length > 0 && (
              <CommandItem
                value={inputValue}
                onSelect={handleCreateNew}
              >
                <Plus className="mr-2 h-4 w-4" />
                Create "{inputValue}"
              </CommandItem>
            )}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
      {onClose && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onClose}
        >
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}