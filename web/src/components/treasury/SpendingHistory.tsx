import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Download,
  Search,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface Transaction {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  status: 'completed' | 'pending' | 'rejected';
  proposalId: string;
  recipient: string;
  approvers: string[];
}

export const SpendingHistory: React.FC = () => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  // const sortBy = useState('date');

  const [transactions] = useState<Transaction[]>([
    {
      id: '1',
      date: '2024-01-15',
      description: 'Q1 Development Team Salaries',
      category: 'Development',
      amount: 85000,
      status: 'completed',
      proposalId: 'PROP-001',
      recipient: 'Dev Team Multi-sig',
      approvers: ['Alice', 'Bob', 'Charlie']
    },
    {
      id: '2',
      date: '2024-01-10',
      description: 'Marketing Campaign - Q1',
      category: 'Marketing',
      amount: 45000,
      status: 'completed',
      proposalId: 'PROP-002',
      recipient: 'Marketing Department',
      approvers: ['Alice', 'David']
    },
    {
      id: '3',
      date: '2024-01-08',
      description: 'Infrastructure Upgrade',
      category: 'Infrastructure',
      amount: 120000,
      status: 'pending',
      proposalId: 'PROP-003',
      recipient: 'Infrastructure Team',
      approvers: ['Alice', 'Bob']
    },
    {
      id: '4',
      date: '2024-01-05',
      description: 'Community Event Sponsorship',
      category: 'Community',
      amount: 25000,
      status: 'rejected',
      proposalId: 'PROP-004',
      recipient: 'Event Organizers',
      approvers: []
    },
    {
      id: '5',
      date: '2023-12-28',
      description: 'Emergency Security Patch',
      category: 'Development',
      amount: 35000,
      status: 'completed',
      proposalId: 'PROP-005',
      recipient: 'Security Team',
      approvers: ['Alice', 'Bob', 'Charlie', 'David']
    }
  ]);

  const filtered = transactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
    const matchesStatus = filterStatus === 'all' || tx.status === filterStatus;
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-600"><CheckCircle className="w-3 h-3 mr-1" />{t('spending.completed')}</Badge>;
      case 'pending':
        return <Badge className="bg-yellow-600"><Clock className="w-3 h-3 mr-1" />{t('spending.pending')}</Badge>;
      case 'rejected':
        return <Badge className="bg-red-600"><XCircle className="w-3 h-3 mr-1" />{t('spending.rejected')}</Badge>;
      default:
        return null;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Development':
        return <TrendingUp className="w-4 h-4 text-blue-500" />;
      case 'Marketing':
        return <FileText className="w-4 h-4 text-purple-500" />;
      case 'Infrastructure':
        return <TrendingDown className="w-4 h-4 text-orange-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="bg-gray-900 border-gray-800">
        <CardHeader>
          <CardTitle className="text-white">{t('spending.title')}</CardTitle>
          <CardDescription className="text-gray-400">
            {t('spending.description')}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                <Input
                  placeholder={t('spending.searchPlaceholder')}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="w-48 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">{t('spending.allCategories')}</SelectItem>
                <SelectItem value="Development">{t('funding.catDevelopment')}</SelectItem>
                <SelectItem value="Marketing">{t('funding.catMarketing')}</SelectItem>
                <SelectItem value="Infrastructure">{t('funding.catInfrastructure')}</SelectItem>
                <SelectItem value="Community">{t('funding.catCommunity')}</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-40 bg-gray-800 border-gray-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700">
                <SelectItem value="all">{t('spending.allStatus')}</SelectItem>
                <SelectItem value="completed">{t('spending.completed')}</SelectItem>
                <SelectItem value="pending">{t('spending.pending')}</SelectItem>
                <SelectItem value="rejected">{t('spending.rejected')}</SelectItem>
              </SelectContent>
            </Select>

            <Button className="bg-blue-600 hover:bg-blue-700">
              <Download className="w-4 h-4 mr-2" />
              {t('spending.export')}
            </Button>
          </div>

          <div className="bg-gray-800 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-gray-700 hover:bg-gray-750">
                  <TableHead className="text-gray-400">{t('spending.date')}</TableHead>
                  <TableHead className="text-gray-400">{t('spending.desc')}</TableHead>
                  <TableHead className="text-gray-400">{t('spending.category')}</TableHead>
                  <TableHead className="text-gray-400">{t('spending.amount')}</TableHead>
                  <TableHead className="text-gray-400">{t('spending.status')}</TableHead>
                  <TableHead className="text-gray-400">{t('spending.proposalId')}</TableHead>
                  <TableHead className="text-gray-400">{t('spending.actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((tx) => (
                  <TableRow key={tx.id} className="border-gray-700 hover:bg-gray-750">
                    <TableCell className="text-gray-300">{tx.date}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getCategoryIcon(tx.category)}
                        <span className="text-white">{tx.description}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-gray-300">{tx.category}</TableCell>
                    <TableCell className="text-white font-mono">
                      ${tx.amount.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(tx.status)}</TableCell>
                    <TableCell className="text-gray-300 font-mono">{tx.proposalId}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm">{t('spending.view')}</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
