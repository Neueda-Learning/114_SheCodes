pipeline {
    agent any

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend Build') {
            steps {
                sh 'cd backend && mvn clean install'
            }
        }

        stage('Frontend Build') {
            steps {
                sh 'cd frontend && npm install && npm run build'
            }
        }

        stage('Docker Build') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                sh 'docker rm -f portfolio-mysql || true'
                sh 'docker compose down'
                sh 'docker compose up -d'
            }
        }
    }
}