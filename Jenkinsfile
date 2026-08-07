// Jenkinsfile — place at project ROOT, alongside pom.xml and docker-compose.yml.
// Requires: Jenkins agent running Linux, with Docker + Docker Compose plugin
// installed, and the Jenkins user added to the `docker` group (see notes below).

pipeline {
    agent any

    environment {
        // Pulled from Jenkins' own Credentials store at run time — never
        // written to disk as a file, never appears in Git. Set this up once
        // under: Jenkins → Manage Jenkins → Credentials → System → Global →
        // Add Credentials → Kind: "Secret text" → ID: db-password
        DB_PASSWORD = credentials('db-password')
        DB_NAME     = 'portfolio_manager'
        JAVA_HOME   = '/usr/lib/jvm/java-21-amazon-corretto'
        PATH        = "${JAVA_HOME}/bin:${env.PATH}"
    }

    stages {

        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend: Build & Test') {
            steps {
                sh 'mvn clean test'
            }
            post {
                always {
                    // Publishes surefire results so Jenkins shows pass/fail
                    // trends over time, not just the latest run's console log.
                    junit '**/target/surefire-reports/*.xml'
                }
            }
        }

        stage('Frontend: Build') {
            steps {
                dir('frontend') {
                    sh 'npm ci'
                    sh 'npm run build'
                }
            }
        }

        stage('Docker: Build Images') {
            steps {
                sh 'docker compose build'
            }
        }

        stage('Deploy') {
            steps {
                // Tears down the previous containers (data in the named
                // volume survives — see docker-compose.yml) and brings up
                // the freshly built images. DB_PASSWORD is already in this
                // shell's environment from the `environment {}` block above,
                // so docker compose picks it up automatically — no .env file
                // involved anywhere in this pipeline.
                sh 'docker compose down'
                sh 'docker compose up -d'
            }
        }
    }

    post {
        failure {
            echo 'Pipeline failed — check the stage logs above. Containers from a prior successful deploy (if any) are left running rather than torn down, so a bad build does not take down a previously working demo.'
        }
        success {
            echo 'Deployed successfully. Backend: http://localhost:8080  Frontend: http://localhost:5173'
        }
    }
}
