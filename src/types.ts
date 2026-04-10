export interface Item {
  id: string;
  code: string;
  name: string;
  date: string;
  description: string;
  createdAt: number;
}

export interface Module {
  id: string;
  title: string;
  type: 'photo' | 'document';
  fileUrl: string;
  fileName: string;
  createdAt: number;
}
