allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    // Some AndroidX deps (e.g. androidx.window) require compileSdk >= 34,
    // while plugin modules like bluetooth_print_plus pin compileSdk 31.
    if (project.name != "app") {
        afterEvaluate {
            extensions.findByType<com.android.build.gradle.BaseExtension>()?.compileSdkVersion(36)
        }
    }
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
