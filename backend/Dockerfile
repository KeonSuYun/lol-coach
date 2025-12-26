FROM python:3.9-slim
WORKDIR /app
RUN apt-get update && apt-get install -y build-essential libffi-dev
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "server.py"]