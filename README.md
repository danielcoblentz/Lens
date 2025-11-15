# Lens
a serverless platform that ingests legal PDFs, extracts key clauses and entities, and lets users ask an AI Agent natural-language questions about the document.

## top lvl structure

'''
lens/
│
├── backend/
│   ├── lambdas/
│   │   ├── llama_get/
│   │   │   ├── handler.py
│   │   │   ├── model.py
│   │   │   └── requirements.txt
│   │   │
│   │   ├── llama_parse/
│   │   │   ├── handler.py
│   │   │   ├── pdf_extract.py
│   │   │   ├── section_extractor.py
│   │   │   ├── embedding_utils.py
│   │   │   └── requirements.txt
│   │   │
│   │   └── llama_query/
│   │       ├── handler.py
│   │       ├── retrieval.py
│   │       ├── prompt_template.py
│   │       └── requirements.txt
│   │
│   ├── shared/
│   │   ├── dynamo.py
│   │   ├── s3.py
│   │   ├── models.py
│   │   └── utils.py
│   │
│   ├── tests/
│   │   ├── test_llama_parse.py
│   │   ├── test_llama_query.py
│   │   └── test_llama_get.py
│   │
│   └── README.md
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── FileUpload.jsx
│   │   │   ├── QueryBox.jsx
│   │   │   └── AnswerBox.jsx
│   │   ├── pages/
│   │   │   ├── index.jsx
│   │   │   └── document.jsx
│   │   ├── lib/
│   │   │   └── apiClient.js
│   │   ├── styles/
│   │   └── utils/
│   ├── package.json
│   └── README.md
│
├── infra/
│   ├── api-gateway.tf
│   ├── lambdas.tf
│   ├── s3.tf
│   ├── dynamodb.tf
│   ├── iam.tf
│   └── variables.tf
│
│
├── Data/
│   ├── sample_contract.pdf
│   └── example_output.json
│
├── .gitignore
├── README.md
└── requirements.txt
'''