import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, CategoryInput } from '../../services/api';

interface CategorySelectorProps {
    selectedCategoryId?: number;
    onSelect: (categoryId?: number) => void;
}

export const CategorySelector: React.FC<CategorySelectorProps> = ({
    selectedCategoryId,
    onSelect,
}) => {
    const [showDropdown, setShowDropdown] = useState(false);
    const [showAddForm, setShowAddForm] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newCategoryColor, setNewCategoryColor] = useState('#3498db');

    const queryClient = useQueryClient();

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: () => api.getCategories(),
    });

    const createMutation = useMutation({
        mutationFn: (category: CategoryInput) => api.createCategory(category),
        onSuccess: (newCategory) => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            onSelect(newCategory.id);
            setShowAddForm(false);
            setNewCategoryName('');
        },
    });

    const selectedCategory = categories.find((c) => c.id === selectedCategoryId);

    return (
        <div style={{ position: 'relative' }}>
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '4px 12px',
                    borderRadius: '20px',
                    border: '1px dashed #ccc',
                    backgroundColor: selectedCategory ? selectedCategory.color : 'transparent',
                    color: selectedCategory ? 'white' : '#666',
                    cursor: 'pointer',
                    fontSize: '14px',
                    minWidth: '100px',
                    justifyContent: 'center',
                    transition: 'all 0.2s',
                }}
            >
                {selectedCategory ? selectedCategory.name : 'Select category'}
            </button>

            {showDropdown && (
                <div
                    style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: '8px',
                        backgroundColor: 'white',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        padding: '8px',
                        minWidth: '200px',
                        zIndex: 1000,
                        border: '1px solid #efefef',
                    }}
                >
                    {categories.length > 0 && (
                        <div style={{ marginBottom: '8px' }}>
                            {categories.map((category) => (
                                <div
                                    key={category.id}
                                    onClick={() => {
                                        onSelect(category.id);
                                        setShowDropdown(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '8px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        backgroundColor: selectedCategoryId === category.id ? '#f0f0f0' : 'transparent',
                                    }}
                                >
                                    <div
                                        style={{
                                            width: '12px',
                                            height: '12px',
                                            borderRadius: '50%',
                                            backgroundColor: category.color,
                                        }}
                                    />
                                    <span>{category.name}</span>
                                </div>
                            ))}
                            <div
                                onClick={() => {
                                    onSelect(undefined);
                                    setShowDropdown(false);
                                }}
                                style={{
                                    padding: '8px',
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    color: '#666',
                                    fontSize: '13px',
                                }}
                            >
                                No category
                            </div>
                            <hr style={{ margin: '8px 0', border: 'none', borderTop: '1px solid #eee' }} />
                        </div>
                    )}

                    {!showAddForm ? (
                        <button
                            onClick={() => setShowAddForm(true)}
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: 'none',
                                backgroundColor: 'transparent',
                                color: '#3498db',
                                cursor: 'pointer',
                                textAlign: 'left',
                                fontSize: '14px',
                            }}
                        >
                            + Create new category
                        </button>
                    ) : (
                        <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <input
                                type="text"
                                placeholder="Category name"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                autoFocus
                                style={{
                                    padding: '6px',
                                    borderRadius: '4px',
                                    border: '1px solid #ddd',
                                    fontSize: '14px',
                                }}
                            />
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                <input
                                    type="color"
                                    value={newCategoryColor}
                                    onChange={(e) => setNewCategoryColor(e.target.value)}
                                    style={{ width: '30px', height: '30px', padding: 0, border: 'none', borderRadius: '4px' }}
                                />
                                <button
                                    disabled={!newCategoryName.trim()}
                                    onClick={() => createMutation.mutate({ name: newCategoryName, color: newCategoryColor })}
                                    style={{
                                        flex: 1,
                                        padding: '6px',
                                        backgroundColor: '#3498db',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}
                                >
                                    Add
                                </button>
                                <button
                                    onClick={() => setShowAddForm(false)}
                                    style={{
                                        padding: '6px',
                                        backgroundColor: '#eee',
                                        border: 'none',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
