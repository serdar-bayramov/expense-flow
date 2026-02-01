'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Sparkles, Loader2, RefreshCw } from 'lucide-react';
import { useAuth } from '@clerk/nextjs';
import { analyticsAPI } from '@/lib/api';


export function AIInsights() {
  const { getToken } = useAuth();
  const [insights, setInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) return;

      const data = await analyticsAPI.getInsights(token);
      setInsights(data.insights);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
      setInsights(["Keep tracking expenses to unlock personalized insights!"]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchInsights();
  };

  if (loading) {
    return (
      <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
        <CardContent className="pt-6">
          <div className="flex items-center justify-center gap-2 text-purple-600 dark:text-purple-400">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Analyzing your expenses...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              AI Insights
            </span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={refreshing}
            className="h-8 w-8 p-0"
          >
            <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div 
              key={index}
              className="p-3 bg-white/60 dark:bg-gray-800/60 rounded-lg border border-purple-200 dark:border-purple-700"
            >
              <p className="text-sm text-gray-800 dark:text-gray-200">
                {insight}
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
