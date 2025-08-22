#!/bin/bash

# Test script for AI metadata generation and linking

API_URL="http://localhost:53211/api/v1"

echo "Creating test notes with AI metadata generation..."

# Create first note about machine learning
NOTE1=$(curl -s -X POST "$API_URL/notes" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Deep Learning Fundamentals\n\nDeep learning is a subset of machine learning that uses neural networks with multiple layers. Key researchers like Geoffrey Hinton, Yann LeCun, and Yoshua Bengio have pioneered this field. Major organizations like OpenAI, Google DeepMind, and Microsoft Research are advancing the state of the art.\n\nCore technologies include:\n- Convolutional Neural Networks (CNNs) for image recognition\n- Recurrent Neural Networks (RNNs) for sequence modeling\n- Transformers for natural language processing\n- PyTorch and TensorFlow frameworks\n\nApplications span computer vision, natural language processing, and reinforcement learning.",
    "format": "markdown",
    "source": "test"
  }' | jq -r '.note_id')

echo "Created note 1: $NOTE1"
sleep 2

# Create second note about NLP
NOTE2=$(curl -s -X POST "$API_URL/notes" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Natural Language Processing with Transformers\n\nTransformers have revolutionized NLP since the Attention is All You Need paper. BERT, GPT, and other transformer models from organizations like Google Research and OpenAI have achieved state-of-the-art results.\n\nKey concepts:\n- Self-attention mechanisms\n- Positional encoding\n- Transfer learning and fine-tuning\n- Large language models\n\nFrameworks like Hugging Face Transformers built on PyTorch make these models accessible. Applications include machine translation, text generation, and question answering.",
    "format": "markdown",
    "source": "test"
  }' | jq -r '.note_id')

echo "Created note 2: $NOTE2"
sleep 2

# Create third note about computer vision
NOTE3=$(curl -s -X POST "$API_URL/notes" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "# Computer Vision and CNNs\n\nConvolutional Neural Networks pioneered by Yann LeCun have transformed computer vision. Modern architectures like ResNet, EfficientNet, and Vision Transformers achieve human-level performance on many tasks.\n\nCore techniques:\n- Convolution and pooling layers\n- Transfer learning from ImageNet\n- Data augmentation\n- Object detection with YOLO and R-CNN\n\nFrameworks like TensorFlow and PyTorch provide pre-trained models. Applications include medical imaging, autonomous vehicles, and facial recognition.",
    "format": "markdown",
    "source": "test"
  }' | jq -r '.note_id')

echo "Created note 3: $NOTE3"

echo -e "\nWaiting 10 seconds for AI processing..."
sleep 10

echo -e "\nFetching notes with metadata..."

# Get first note with metadata
echo -e "\n=== Note 1: Deep Learning Fundamentals ==="
curl -s "$API_URL/notes/$NOTE1" | jq '{
  title: .original.content | split("\n")[0],
  ai_metadata: .revised.ai_metadata,
  tags: .tags,
  links: .links | length
}'

# Get second note with metadata
echo -e "\n=== Note 2: NLP with Transformers ==="
curl -s "$API_URL/notes/$NOTE2" | jq '{
  title: .original.content | split("\n")[0],
  ai_metadata: .revised.ai_metadata,
  tags: .tags,
  links: .links | length
}'

# Get third note with metadata
echo -e "\n=== Note 3: Computer Vision ==="
curl -s "$API_URL/notes/$NOTE3" | jq '{
  title: .original.content | split("\n")[0],
  ai_metadata: .revised.ai_metadata,
  tags: .tags,
  links: .links | length
}'

echo -e "\n=== Testing Semantic Search ==="
curl -s "$API_URL/search?q=neural+networks&mode=semantic" | jq '[.notes[] | {title: .snippet | split("\n")[0], score: .score}]'

echo -e "\n=== Testing Hybrid Search ==="
curl -s "$API_URL/search?q=transformers&mode=hybrid" | jq '[.notes[] | {title: .snippet | split("\n")[0], score: .score}]'

echo -e "\n=== Checking Links Between Notes ==="
# Check if notes are linked
curl -s "$API_URL/notes/$NOTE1" | jq '.links[] | {to_note: .to_note_id, kind: .kind, score: .score}'

echo -e "\nTest complete!"