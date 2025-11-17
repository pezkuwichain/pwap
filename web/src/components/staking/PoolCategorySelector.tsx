import React, { useState } from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { ValidatorPoolCategory } from '@shared/lib/validator-pool';

interface PoolCategorySelectorProps {
  currentCategory?: ValidatorPoolCategory;
  onCategoryChange: (category: ValidatorPoolCategory) => void;
  disabled?: boolean;
}

const POOL_CATEGORIES = Object.values(ValidatorPoolCategory);

export function PoolCategorySelector({ currentCategory, onCategoryChange, disabled }: PoolCategorySelectorProps) {
  const [selectedCategory, setSelectedCategory] = useState<ValidatorPoolCategory>(currentCategory || POOL_CATEGORIES[0]);

  const handleSubmit = () => {
    onCategoryChange(selectedCategory);
  };

  return (
    <div className="space-y-4">
      <Select value={selectedCategory} onValueChange={(value) => setSelectedCategory(value as ValidatorPoolCategory)} disabled={disabled}>
        <SelectTrigger className="w-full bg-gray-800 border-gray-700 text-white">
          <SelectValue placeholder="Select a pool category..." />
        </SelectTrigger>
        <SelectContent>
          {POOL_CATEGORIES.map(cat => (
            <SelectItem key={cat} value={cat}>{cat.replace(/([A-Z])/g, ' $1').trim()}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleSubmit} disabled={disabled || !selectedCategory} className="w-full">
        {disabled && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        {currentCategory ? 'Switch Category' : 'Join Pool'}
      </Button>
    </div>
  );
}
